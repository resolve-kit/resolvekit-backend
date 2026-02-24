import re
import logging
import time
from typing import Any

import httpx

from ios_app_agent.schemas.agent_config import ModelInfo, ProviderInfo

PROVIDERS: list[ProviderInfo] = [
    ProviderInfo(id="openai", name="OpenAI", custom_base_url=False),
    ProviderInfo(id="anthropic", name="Anthropic", custom_base_url=False),
    ProviderInfo(id="google", name="Google", custom_base_url=False),
    ProviderInfo(id="nexos", name="Nexos AI", custom_base_url=True),
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
_OPENAI_EMBEDDING_PATTERN = re.compile(r"^text-embedding-")
_GENERIC_EMBEDDING_PATTERN = re.compile(r"(embed|embedding)")

PROVIDER_API_URLS: dict[str, str] = {
    "openai": "https://api.openai.com/v1/models",
    "anthropic": "https://api.anthropic.com/v1/models",
    "google": "https://generativelanguage.googleapis.com/v1beta/models",
    "nexos": "https://api.nexos.ai/v1/models",
}

FALLBACK_EMBEDDING_MODELS: dict[str, list[ModelInfo]] = {
    "openai": [
        ModelInfo(id="text-embedding-3-large", name="text-embedding-3-large"),
        ModelInfo(id="text-embedding-3-small", name="text-embedding-3-small"),
        ModelInfo(id="text-embedding-ada-002", name="text-embedding-ada-002"),
    ],
    "anthropic": [
        ModelInfo(id="claude-embedding-1", name="Claude Embedding 1"),
    ],
    "google": [
        ModelInfo(id="text-embedding-004", name="text-embedding-004"),
        ModelInfo(id="gemini-embedding-001", name="gemini-embedding-001"),
    ],
    "nexos": [],
}

logger = logging.getLogger(__name__)


def list_providers() -> list[ProviderInfo]:
    return PROVIDERS


def is_supported_provider(provider_id: str) -> bool:
    return any(provider.id == provider_id for provider in PROVIDERS)


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
            models = await _fetch_models(provider_id, api_url, api_key, mode="chat")
            if models:
                return models, True, None
        except Exception as exc:
            logger.warning("model_fetch_failed provider=%s api_url=%s error=%s", provider_id, api_url, str(exc))
            return FALLBACK_MODELS.get(provider_id, []), False, str(exc)

    return FALLBACK_MODELS.get(provider_id, []), False, None


async def list_embedding_models_for_provider(
    provider_id: str,
    api_key: str | None = None,
    api_base: str | None = None,
) -> tuple[list[ModelInfo], bool, str | None]:
    """Returns (models, is_dynamic, error) for embedding-capable models."""
    if provider_id == "nexos":
        if not api_key:
            return [], False, "Nexos API key required to load embedding models"

        nexos_base = api_base.rstrip("/") if api_base else "https://api.nexos.ai/v1"
        embedding_models_url = f"{nexos_base}/embeddings/models"
        try:
            models = await _fetch_nexos_embeddings_models(embedding_models_url, api_key)
            if models:
                return models, True, None
            return [], True, "Nexos returned no embedding models for this API key"
        except Exception as exc:
            logger.warning(
                "embedding_model_fetch_failed provider=%s api_url=%s error=%s",
                provider_id,
                embedding_models_url,
                str(exc),
            )
            return [], False, _format_nexos_embedding_error(exc)

    api_url = PROVIDER_API_URLS.get(provider_id)

    if api_url and api_key:
        try:
            models = await _fetch_models(provider_id, api_url, api_key, mode="embedding")
            if models:
                return models, True, None
        except Exception as exc:
            logger.warning(
                "embedding_model_fetch_failed provider=%s api_url=%s error=%s",
                provider_id,
                api_url,
                str(exc),
            )
            return FALLBACK_EMBEDDING_MODELS.get(provider_id, []), False, str(exc)

    return FALLBACK_EMBEDDING_MODELS.get(provider_id, []), False, None


async def _fetch_nexos_embeddings_models(api_url: str, api_key: str) -> list[ModelInfo]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        last_exc: httpx.HTTPStatusError | None = None
        forbidden_exc: httpx.HTTPStatusError | None = None

        for auth_value in _nexos_auth_candidates(api_key):
            try:
                resp = await client.get(
                    api_url,
                    headers={
                        "Authorization": auth_value,
                        "Accept": "application/json",
                    },
                )
                resp.raise_for_status()
                payload = resp.json()
                raw_models = payload.get("data", []) if isinstance(payload, dict) else []
                return _to_model_info(raw_models)
            except httpx.HTTPStatusError as exc:
                last_exc = exc
                if exc.response.status_code == 403 and forbidden_exc is None:
                    forbidden_exc = exc
                if exc.response.status_code in {401, 403}:
                    continue
                raise

        if forbidden_exc is not None:
            raise forbidden_exc
        if last_exc is not None:
            raise last_exc
    raise RuntimeError("Failed to authenticate with Nexos embedding models endpoint")


def _auth_header(provider_id: str, api_key: str) -> str:
    token = _normalize_api_token(api_key)

    # Nexos Gateway API uses OAuth2 bearer tokens.
    if provider_id == "nexos":
        return f"Bearer {token}"
    return f"Bearer {token}"


def _normalize_api_token(api_key: str) -> str:
    key = api_key.strip()
    lower = key.lower()
    if lower.startswith("bearer "):
        return key[7:].strip()
    if lower.startswith("hydra "):
        return key[6:].strip()
    return key


def _nexos_auth_candidates(api_key: str) -> list[str]:
    token = _normalize_api_token(api_key)
    # Support both observed schemes in the wild.
    return [f"Bearer {token}", f"hydra {token}"]


async def _fetch_models(
    provider_id: str,
    api_url: str,
    api_key: str,
    mode: str = "chat",
) -> list[ModelInfo]:
    token = _normalize_api_token(api_key)
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
        elif provider_id == "anthropic":
            resp = await client.get(
                api_url,
                headers={
                    "x-api-key": token,
                    "anthropic-version": "2023-06-01",
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
        elif provider_id == "google":
            resp = await client.get(
                api_url,
                params={"key": token},
                headers={"Accept": "application/json"},
            )
            resp.raise_for_status()
            google_payload = resp.json()
            data = {"data": _google_models_to_data(google_payload.get("models", []), mode)}
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

    if mode == "embedding":
        return _filter_embedding_models(provider_id, raw_models)

    if provider_id == "openai" and mode == "chat":
        return _filter_openai_models(raw_models)

    return _to_model_info(raw_models)


def _google_models_to_data(raw_models: Any, mode: str) -> list[dict[str, str]]:
    if not isinstance(raw_models, list):
        return []

    records: list[dict[str, str]] = []
    for raw in raw_models:
        if not isinstance(raw, dict):
            continue
        source_name = raw.get("name")
        if not isinstance(source_name, str):
            continue

        methods_raw = raw.get("supportedGenerationMethods", [])
        methods = {
            str(method).strip().lower()
            for method in methods_raw
            if isinstance(method, str)
        }
        lowered_name = source_name.lower()

        supports_mode = False
        if mode == "embedding":
            supports_mode = "embedcontent" in methods or "embedding" in lowered_name
        else:
            supports_mode = (
                "generatecontent" in methods
                or "counttokens" in methods
                or ("embedding" not in lowered_name and "embed" not in lowered_name)
            )

        if not supports_mode:
            continue

        model_id = source_name[len("models/") :] if source_name.startswith("models/") else source_name
        display_name = raw.get("displayName")
        records.append(
            {
                "id": model_id,
                "name": display_name if isinstance(display_name, str) and display_name.strip() else model_id,
            }
        )
    return records


def _extract_http_error_message(response: httpx.Response) -> str | None:
    try:
        payload = response.json()
    except Exception:
        return None

    if isinstance(payload, dict):
        err = payload.get("error")
        if isinstance(err, dict):
            message = err.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()
            code = err.get("code")
            if isinstance(code, str) and code.strip():
                return code.strip()
        if isinstance(err, str) and err.strip():
            return err.strip()

        detail = payload.get("detail")
        if isinstance(detail, str) and detail.strip():
            return detail.strip()
    return None


def _format_nexos_embedding_error(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        status_code = exc.response.status_code
        message = _extract_http_error_message(exc.response)
        normalized = message.lower() if isinstance(message, str) else ""

        if status_code == 403 and "action is not allowed" in normalized:
            return "Nexos embeddings are not enabled for this API key"
        if status_code in {401, 403}:
            return "Nexos API key is not authorized for embeddings"
        if message:
            return message

    return str(exc)


def _to_model_info(raw: list[dict[str, Any]]) -> list[ModelInfo]:
    return [
        ModelInfo(id=m["id"], name=m.get("name", m["id"]))
        for m in raw
        if isinstance(m.get("id"), str)
    ]


def _filter_openai_models(raw: list[dict[str, Any]]) -> list[ModelInfo]:
    models = []
    for m in raw:
        mid = m.get("id", "")
        if _OPENAI_CHAT_PATTERN.search(mid):
            models.append(ModelInfo(id=mid, name=mid))
    models.sort(key=lambda x: x.id)
    return models


def _filter_embedding_models(provider_id: str, raw: list[dict[str, Any]]) -> list[ModelInfo]:
    models: list[ModelInfo] = []
    for m in raw:
        mid = m.get("id", "")
        if not isinstance(mid, str):
            continue
        name = m.get("name", mid)
        match_text = f"{mid} {name}".lower()

        if provider_id == "openai":
            if _OPENAI_EMBEDDING_PATTERN.search(mid):
                models.append(ModelInfo(id=mid, name=name))
            continue

        if _GENERIC_EMBEDDING_PATTERN.search(match_text):
            models.append(ModelInfo(id=mid, name=name))

    models.sort(key=lambda x: x.id)
    return models


async def test_provider_connection(
    provider: str,
    api_key: str | None,
    api_base: str | None,
) -> dict[str, object]:
    normalized_provider = provider.strip().lower()
    if not is_supported_provider(normalized_provider):
        return {"ok": False, "latency_ms": None, "error": f"Unsupported provider: {provider}"}

    if not api_key:
        return {"ok": False, "latency_ms": None, "error": "API key required"}
    normalized_key = api_key.strip()
    if not normalized_key:
        return {"ok": False, "latency_ms": None, "error": "API key required"}

    start = time.monotonic()
    try:
        models, is_dynamic, error = await list_models_for_provider(normalized_provider, normalized_key, api_base)
        elapsed_ms = int((time.monotonic() - start) * 1000)
        if error:
            return {"ok": False, "latency_ms": None, "error": error}
        if not is_dynamic:
            return {
                "ok": False,
                "latency_ms": None,
                "error": "Could not verify connection with live provider response",
            }
        if not models:
            return {
                "ok": False,
                "latency_ms": None,
                "error": "No models returned - check your API key",
            }
        return {"ok": True, "latency_ms": elapsed_ms, "error": None}
    except Exception as exc:
        return {"ok": False, "latency_ms": None, "error": str(exc)}


test_provider_connection.__test__ = False
