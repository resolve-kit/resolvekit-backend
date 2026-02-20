import re
import logging
from typing import Any

import httpx

from ios_app_agent.schemas.agent_config import ModelInfo, ProviderInfo

PROVIDERS: list[ProviderInfo] = [
    ProviderInfo(id="openai", name="OpenAI"),
    ProviderInfo(id="anthropic", name="Anthropic"),
    ProviderInfo(id="google", name="Google"),
    ProviderInfo(id="nexos", name="Nexos AI"),
]

FALLBACK_MODELS: dict[str, list[ModelInfo]] = {
    "openai": [
        ModelInfo(id="gpt-4o", name="GPT-4o"),
        ModelInfo(id="gpt-4o-mini", name="GPT-4o Mini"),
        ModelInfo(id="gpt-4-turbo", name="GPT-4 Turbo"),
        ModelInfo(id="gpt-3.5-turbo", name="GPT-3.5 Turbo"),
    ],
    "anthropic": [
        ModelInfo(id="claude-opus-4-5", name="Claude Opus 4.5"),
        ModelInfo(id="claude-sonnet-4-5", name="Claude Sonnet 4.5"),
        ModelInfo(id="claude-haiku-3-5", name="Claude Haiku 3.5"),
    ],
    "google": [
        ModelInfo(id="gemini-2.0-flash", name="Gemini 2.0 Flash"),
        ModelInfo(id="gemini-1.5-pro", name="Gemini 1.5 Pro"),
        ModelInfo(id="gemini-1.5-flash", name="Gemini 1.5 Flash"),
    ],
    "nexos": [],
}

_OPENAI_CHAT_PATTERN = re.compile(r"^(gpt-|o[13])")

PROVIDER_API_URLS: dict[str, str] = {
    "openai": "https://api.openai.com/v1/models",
    "nexos": "https://api.nexos.ai/v1/models",
}

logger = logging.getLogger(__name__)


def list_providers() -> list[ProviderInfo]:
    return PROVIDERS


async def list_models_for_provider(
    provider_id: str,
    api_key: str | None = None,
    api_base: str | None = None,
) -> tuple[list[ModelInfo], bool, str | None]:
    """Returns (models, is_dynamic, error). is_dynamic=True means fetched live."""
    api_url = PROVIDER_API_URLS.get(provider_id)
    if provider_id == "nexos" and api_base:
        api_url = f"{api_base.rstrip('/')}/models"

    if api_url and api_key:
        try:
            models = await _fetch_models(provider_id, api_url, api_key)
            if models:
                return models, True, None
        except Exception as exc:
            logger.warning("model_fetch_failed provider=%s api_url=%s error=%s", provider_id, api_url, str(exc))
            return FALLBACK_MODELS.get(provider_id, []), False, str(exc)

    return FALLBACK_MODELS.get(provider_id, []), False, None


def _auth_header(provider_id: str, api_key: str) -> str:
    if api_key.lower().startswith("bearer "):
        token = api_key[7:].strip()
    elif api_key.lower().startswith("hydra "):
        token = api_key[6:].strip()
    else:
        token = api_key.strip()

    # Nexos Gateway API uses OAuth2 bearer tokens.
    if provider_id == "nexos":
        return f"Bearer {token}"
    return f"Bearer {token}"


def _nexos_auth_candidates(api_key: str) -> list[str]:
    key = api_key.strip()
    lower = key.lower()
    if lower.startswith("bearer "):
        token = key[7:].strip()
    elif lower.startswith("hydra "):
        token = key[6:].strip()
    else:
        token = key
    # Support both observed schemes in the wild.
    return [f"Bearer {token}", f"hydra {token}"]


async def _fetch_models(
    provider_id: str, api_url: str, api_key: str
) -> list[ModelInfo]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        if provider_id == "nexos":
            last_exc: Exception | None = None
            for auth_value in _nexos_auth_candidates(api_key):
                try:
                    resp = await client.get(
                        api_url,
                        headers={
                            "Authorization": auth_value,
                            "Accept": "*/*",
                        },
                    )
                    resp.raise_for_status()
                    data: dict[str, Any] = resp.json()
                    break
                except httpx.HTTPStatusError as exc:
                    last_exc = exc
                    if exc.response.status_code in {401, 403}:
                        continue
                    raise
            else:
                if last_exc:
                    raise last_exc
                raise RuntimeError("Failed to authenticate with Nexos models endpoint")
        else:
            resp = await client.get(
                api_url,
                headers={
                    "Authorization": _auth_header(provider_id, api_key),
                    "Accept": "*/*",
                },
            )
            resp.raise_for_status()
            data = resp.json()

    raw_models: list[dict[str, Any]] = data.get("data", [])

    if provider_id == "openai":
        return _filter_openai_models(raw_models)

    return [
        ModelInfo(id=m["id"], name=m.get("name", m["id"]))
        for m in raw_models
    ]


def _filter_openai_models(raw: list[dict[str, Any]]) -> list[ModelInfo]:
    models = []
    for m in raw:
        mid = m.get("id", "")
        if _OPENAI_CHAT_PATTERN.search(mid):
            models.append(ModelInfo(id=mid, name=mid))
    models.sort(key=lambda x: x.id)
    return models
