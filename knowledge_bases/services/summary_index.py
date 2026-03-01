from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from knowledge_bases.models import KnowledgeBase, KnowledgeDocument
from knowledge_bases.services.crypto import decrypt_secret
from knowledge_bases.services.llm_compat import acompletion_with_temperature_fallback
from knowledge_bases.services.usage_tracking import (
    estimate_tokens_from_text,
    record_usage_event,
    usage_tokens_from_litellm_response,
)

_MAX_DOCS = 80
_MAX_DOC_CHARS = 700
_MAX_PROMPT_CHARS = 16_000
_MAX_SUMMARY_CHARS = 600
_MAX_TOPICS = 15


def _model_is_invalid_summary_model(model: str | None) -> bool:
    if not model:
        return True
    return bool(re.search(r"(?:^|[-_/])embed(?:ding)?(?:$|[-_/])", model.strip().lower()))


def _strip_json_fence(raw: str) -> str:
    stripped = raw.strip()
    if not stripped.startswith("```"):
        return stripped
    parts = stripped.split("```")
    if len(parts) < 2:
        return stripped
    fenced = parts[1].strip()
    if fenced.lower().startswith("json"):
        fenced = fenced[4:].strip()
    return fenced


def _normalize_summary(text: str) -> str:
    collapsed = re.sub(r"\s+", " ", (text or "").strip())
    return collapsed[:_MAX_SUMMARY_CHARS].strip()


def _normalize_topics(raw_topics: list[str] | tuple[str, ...] | None) -> list[str]:
    if not raw_topics:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for topic in raw_topics:
        if not isinstance(topic, str):
            continue
        text = re.sub(r"\s+", " ", topic.strip())
        if not text:
            continue
        lowered = text.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        normalized.append(text[:80])
        if len(normalized) >= _MAX_TOPICS:
            break
    return normalized


def _extract_content_text(content: object) -> str:
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return ""

    parts: list[str] = []
    for item in content:
        if isinstance(item, str):
            text = item.strip()
            if text:
                parts.append(text)
            continue
        if not isinstance(item, dict):
            continue
        for key in ("text", "content", "value"):
            value = item.get(key)
            if isinstance(value, str):
                text = value.strip()
                if text:
                    parts.append(text)
                break
    return " ".join(parts).strip()


def _extract_raw_response_text(response: object) -> str:
    choices = response.get("choices", []) if isinstance(response, dict) else []
    if not choices:
        return ""
    message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
    return _extract_content_text(message.get("content"))


def _try_parse_summary_json(raw: str) -> dict[str, object] | None:
    stripped = _strip_json_fence(raw)
    candidates: list[str] = []
    if stripped:
        candidates.append(stripped)

    # Some models prepend commentary and include the JSON body later.
    for match in re.finditer(r"\{[\s\S]*\}", stripped):
        candidate = match.group(0).strip()
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except Exception:
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


def _fallback_summary_from_docs(docs: list[KnowledgeDocument]) -> str:
    titles = [re.sub(r"\s+", " ", (doc.title or "").strip()) for doc in docs if (doc.title or "").strip()]
    if titles:
        head = ", ".join(titles[:3])
        tail = " and more" if len(titles) > 3 else ""
        return _normalize_summary(f"Indexed content includes: {head}{tail}.")

    for doc in docs:
        excerpt = re.sub(r"\s+", " ", (doc.content_markdown or "").strip())
        if excerpt:
            return _normalize_summary(f"Indexed content includes: {excerpt[:220]}.")
    return "Indexed knowledge-base content is available for support guidance."


def _resolve_model_name(provider: str | None, model: str) -> str:
    provider_norm = (provider or "").strip().lower()
    if provider_norm and provider_norm != "nexos" and "/" not in model:
        return f"{provider_norm}/{model}"
    return model


def _build_docs_blob(docs: list[KnowledgeDocument]) -> tuple[str, str]:
    lines: list[str] = []
    hashes: list[str] = []

    for idx, doc in enumerate(docs[:_MAX_DOCS], start=1):
        title = (doc.title or "Untitled").strip()
        url = (doc.canonical_url or "").strip()
        content = re.sub(r"\s+", " ", (doc.content_markdown or "").strip())[:_MAX_DOC_CHARS]
        if content:
            lines.append(f"{idx}. Title: {title}\nURL: {url or 'N/A'}\nExcerpt: {content}")
        hashes.append(doc.content_hash)

    blob = "\n\n".join(lines)
    if len(blob) > _MAX_PROMPT_CHARS:
        blob = blob[:_MAX_PROMPT_CHARS].rstrip()
    fingerprint_seed = "|".join(sorted(hashes))
    fingerprint = hashlib.sha256(fingerprint_seed.encode("utf-8")).hexdigest() if fingerprint_seed else ""
    return blob, fingerprint


async def refresh_kb_summary_index(
    db: AsyncSession,
    *,
    kb: KnowledgeBase,
) -> None:
    now = datetime.now(timezone.utc)
    if not kb.summary_model or not kb.summary_provider or not kb.summary_api_key_encrypted or not kb.summary_llm_profile_id:
        kb.summary_status = "disabled"
        kb.summary_text = None
        kb.summary_topics_json = []
        kb.summary_last_error = None
        kb.summary_updated_at = now
        kb.summary_content_fingerprint = None
        return

    if _model_is_invalid_summary_model(kb.summary_model):
        kb.summary_status = "failed"
        kb.summary_last_error = "Summary model must be a chat-capable model, not an embedding model"
        kb.summary_updated_at = now
        return

    docs_result = await db.execute(
        select(KnowledgeDocument)
        .where(KnowledgeDocument.knowledge_base_id == kb.id)
        .order_by(KnowledgeDocument.updated_at.desc())
        .limit(_MAX_DOCS)
    )
    docs = docs_result.scalars().all()
    docs_blob, fingerprint = _build_docs_blob(docs)
    if not docs_blob:
        kb.summary_status = "ready"
        kb.summary_text = "No content indexed yet."
        kb.summary_topics_json = []
        kb.summary_last_error = None
        kb.summary_updated_at = now
        kb.summary_content_fingerprint = fingerprint or None
        return

    prompt = (
        "You maintain a compact knowledge-base index for support agents.\n"
        "Return strict JSON with shape: "
        '{"summary":"2-4 sentences about what this KB covers","topics":["topic 1","topic 2"]}.\n'
        "Topics should be short and actionable. Do not include markdown."
    )

    model = _resolve_model_name(kb.summary_provider, kb.summary_model)
    api_key = decrypt_secret(kb.summary_api_key_encrypted)

    try:
        response = await acompletion_with_temperature_fallback(
            model=model,
            api_key=api_key,
            api_base=kb.summary_api_base,
            temperature=0,
            max_tokens=320,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": docs_blob},
            ],
        )
        input_tokens, output_tokens = usage_tokens_from_litellm_response(response)
        if input_tokens is None:
            input_tokens = estimate_tokens_from_text(docs_blob) + estimate_tokens_from_text(prompt)
        try:
            await record_usage_event(
                db,
                organization_id=kb.organization_id,
                knowledge_base_id=kb.id,
                provider=kb.summary_provider or "unknown",
                model=kb.summary_model or model,
                operation="kb_summary_generation",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            )
        except Exception:
            # Usage accounting must never block summary generation.
            pass
        raw = _extract_raw_response_text(response)
        parsed = _try_parse_summary_json(raw)
        if parsed:
            summary = _normalize_summary(str(parsed.get("summary", "")))
            topics = _normalize_topics(parsed.get("topics") if isinstance(parsed, dict) else [])
        else:
            summary = _normalize_summary(raw)
            topics = []

        if not summary:
            summary = _fallback_summary_from_docs(docs)

        kb.summary_text = summary
        kb.summary_topics_json = topics
        kb.summary_status = "ready"
        kb.summary_last_error = None
        kb.summary_updated_at = now
        kb.summary_content_fingerprint = fingerprint or None
    except Exception as exc:
        kb.summary_status = "failed"
        kb.summary_last_error = str(exc)[:1000]
        kb.summary_updated_at = now
