from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass
from pathlib import Path
import re
import uuid
from urllib.parse import urlparse

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from knowledge_bases.config import settings
from knowledge_bases.services.crawling import CrawledImage
from knowledge_bases.services.embedding import EmbeddingRuntimeConfig
from knowledge_bases.services.llm_compat import acompletion_with_temperature_fallback
from knowledge_bases.services.usage_tracking import (
    estimate_tokens_from_text,
    record_usage_event,
    usage_tokens_from_litellm_response,
)

_NEGATIVE_HINTS = ("logo", "icon", "sprite", "avatar", "badge", "favicon", "banner", "tracking")
_POSITIVE_HINTS = ("screenshot", "step", "tutorial", "settings", "account", "click", "tap")
_SUPPORTED_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
_EXT_BY_MIME = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
}


@dataclass(frozen=True)
class RankedImageCandidate:
    image: CrawledImage
    score: float


def _lower_blob(*parts: str | None) -> str:
    return " ".join((part or "").strip().lower() for part in parts if part)


def score_image_candidate(image: CrawledImage) -> float:
    score = 0.0
    blob = _lower_blob(
        image.url,
        image.alt_text,
        image.title_text,
        image.context_text,
        image.section_heading,
        image.css_class,
        image.element_id,
    )

    if image.in_chrome:
        score -= 3.0
    if image.width is not None and image.height is not None:
        area = image.width * image.height
        if area >= 250_000:
            score += 2.5
        elif area <= 5_000:
            score -= 2.0
    if image.alt_text:
        score += 1.2
    if image.context_text:
        score += 1.0
    if image.section_heading:
        score += 0.8

    if any(token in blob for token in _POSITIVE_HINTS):
        score += 2.0
    if any(token in blob for token in _NEGATIVE_HINTS):
        score -= 3.0

    parsed = urlparse(image.url)
    if parsed.scheme in {"http", "https"}:
        score += 0.2

    return score


def select_relevant_images(
    images: list[CrawledImage],
    *,
    max_images: int,
) -> list[RankedImageCandidate]:
    ranked = [RankedImageCandidate(image=image, score=score_image_candidate(image)) for image in images]
    ranked.sort(key=lambda item: (item.score, -item.image.dom_index), reverse=True)
    filtered = [item for item in ranked if item.score > 0]
    return filtered[: max(0, max_images)]


def build_asset_relpath(
    *,
    organization_id: uuid.UUID,
    knowledge_base_id: uuid.UUID,
    content_hash: str,
    extension: str,
) -> str:
    ext = extension if extension.startswith(".") else f".{extension}"
    ext = ext.lower()
    return f"{organization_id}/{knowledge_base_id}/{content_hash}{ext}"


def _extension_for_url(url: str) -> str:
    path = urlparse(url).path or ""
    suffix = Path(path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    return ".png"


def _extension_for_content_type(content_type: str | None, *, fallback_url: str) -> str:
    normalized = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized in _EXT_BY_MIME:
        return _EXT_BY_MIME[normalized]
    return _extension_for_url(fallback_url)


def _is_supported_content_type(content_type: str | None) -> bool:
    if not content_type:
        return False
    normalized = content_type.split(";", 1)[0].strip().lower()
    return normalized in _SUPPORTED_MIME_TYPES


def _content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def remove_asset_file(relative_path: str | None) -> None:
    if not relative_path:
        return
    root = Path(settings.multimodal_assets_dir)
    absolute = root / relative_path
    try:
        absolute.unlink(missing_ok=True)
    except Exception:
        return


async def download_image_bytes(url: str) -> tuple[bytes, str | None] | None:
    timeout = httpx.Timeout(settings.multimodal_image_timeout_seconds)
    headers = {"User-Agent": settings.crawl_user_agent}
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
    except Exception:
        return None

    content_type = response.headers.get("content-type")
    payload = response.content
    if not payload:
        return None
    if len(payload) > settings.multimodal_image_max_file_bytes:
        return None
    if content_type and not _is_supported_content_type(content_type):
        return None
    return payload, content_type


def persist_image_asset(
    *,
    organization_id: uuid.UUID,
    knowledge_base_id: uuid.UUID,
    source_url: str,
    image_bytes: bytes,
    content_type: str | None,
) -> tuple[str, str, str]:
    content_hash = _content_hash(image_bytes)
    extension = _extension_for_content_type(content_type, fallback_url=source_url)
    relpath = build_asset_relpath(
        organization_id=organization_id,
        knowledge_base_id=knowledge_base_id,
        content_hash=content_hash,
        extension=extension,
    )
    root = Path(settings.multimodal_assets_dir)
    absolute = root / relpath
    absolute.parent.mkdir(parents=True, exist_ok=True)
    if not absolute.exists():
        absolute.write_bytes(image_bytes)
    resolved_content_type = (content_type or "").split(";", 1)[0].strip().lower() or (
        "image/png" if extension == ".png" else "image/jpeg" if extension == ".jpg" else "image/webp"
    )
    return relpath, content_hash, resolved_content_type


def _build_data_url(image_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _caption_model_for_provider(provider: str) -> str:
    normalized = provider.strip().lower()
    if normalized == "google":
        return "gemini-2.0-flash"
    if normalized == "anthropic":
        return "claude-3-5-sonnet-latest"
    return "gpt-4o-mini"


async def generate_caption_with_vision_model(
    *,
    db: AsyncSession | None = None,
    organization_id: uuid.UUID | None = None,
    knowledge_base_id: uuid.UUID | None = None,
    runtime: EmbeddingRuntimeConfig | None,
    image_bytes: bytes,
    mime_type: str,
    context_text: str | None,
) -> str:
    if not runtime or not settings.multimodal_caption_enabled:
        return ""

    model_name = _caption_model_for_provider(runtime.provider)
    model = model_name
    if runtime.provider and runtime.provider not in {"nexos"} and "/" not in model_name:
        model = f"{runtime.provider}/{model_name}"

    prompt_context = (context_text or "").strip()
    prompt = "Describe this app/tutorial screenshot with focus on actionable UI flow and visible controls."
    if prompt_context:
        prompt = f"{prompt} Context: {prompt_context}"

    try:
        response = await acompletion_with_temperature_fallback(
            model=model,
            api_key=runtime.api_key,
            api_base=runtime.api_base,
            temperature=0,
            max_tokens=220,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": _build_data_url(image_bytes, mime_type)}},
                    ],
                }
            ],
        )
        if db is not None and organization_id is not None and knowledge_base_id is not None:
            input_tokens, output_tokens = usage_tokens_from_litellm_response(response)
            if input_tokens is None:
                input_tokens = estimate_tokens_from_text(prompt)
            await record_usage_event(
                db,
                organization_id=organization_id,
                knowledge_base_id=knowledge_base_id,
                provider=runtime.provider,
                model=model_name,
                operation="kb_image_caption",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                image_count=1,
            )
    except Exception:
        return ""

    choices = response.get("choices", []) if isinstance(response, dict) else []
    if not choices:
        return ""
    message = choices[0].get("message", {})
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    text_parts.append(text.strip())
        return " ".join(text_parts).strip()
    return ""


def extract_ocr_text(image_bytes: bytes) -> str:
    try:
        from PIL import Image
        import pytesseract
    except Exception:
        return ""

    try:
        from io import BytesIO

        with Image.open(BytesIO(image_bytes)) as image:
            text = pytesseract.image_to_string(image)
    except Exception:
        return ""
    return re.sub(r"\\s+", " ", text).strip()
