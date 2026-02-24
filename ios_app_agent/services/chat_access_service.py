import time
import uuid
from collections.abc import Mapping
from typing import Any
import logging

from fastapi import HTTPException, status
from jose import JWTError, jwt

from ios_app_agent.config import settings
from ios_app_agent.models.app import App

CHAT_UNAVAILABLE_CODE = "chat_unavailable"
CHAT_UNAVAILABLE_MESSAGE = "Chat is unavailable, try again later"
CHAT_CAPABILITY_HEADER = "X-Playbook-Chat-Capability"
CHAT_CAPABILITY_QUERY = "chat_capability"

logger = logging.getLogger(__name__)


def _chat_capability_secret() -> str:
    return settings.chat_capability_secret or settings.jwt_secret


def chat_unavailable_http_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": CHAT_UNAVAILABLE_CODE, "message": CHAT_UNAVAILABLE_MESSAGE},
    )


def ensure_chat_available_for_app(app: App) -> None:
    if not app.integration_enabled:
        logger.info("chat_unavailable app_integration_disabled app_id=%s version=%s", app.id, app.integration_version)
        raise chat_unavailable_http_exception()


def apply_runtime_llm_profile(agent_config: Any, profile: Any) -> None:
    """Inject runtime provider credentials without changing selected app model."""
    agent_config.llm_provider = profile.provider
    agent_config.llm_api_key_encrypted = profile.api_key_encrypted
    agent_config.llm_api_base = profile.api_base


def issue_chat_capability_token(
    *,
    session_id: uuid.UUID,
    app: App,
    ttl_seconds: int | None = None,
) -> str:
    ensure_chat_available_for_app(app)
    issued_at = int(time.time())
    expires_at = issued_at + (ttl_seconds or settings.chat_capability_ttl_seconds)

    payload = {
        "sid": str(session_id),
        "aid": str(app.id),
        "iv": int(app.integration_version),
        "iat": issued_at,
        "nbf": issued_at,
        "exp": expires_at,
    }

    token = jwt.encode(payload, _chat_capability_secret(), algorithm=settings.jwt_algorithm)
    logger.debug("issued_chat_capability_token app_id=%s session_id=%s version=%s", app.id, session_id, app.integration_version)
    return token


def validate_chat_capability_token(
    *,
    token: str | None,
    session_id: uuid.UUID,
    app: App,
) -> None:
    ensure_chat_available_for_app(app)

    if token is None or not token.strip():
        logger.info("chat_capability_missing app_id=%s session_id=%s", app.id, session_id)
        raise chat_unavailable_http_exception()

    try:
        payload: dict[str, Any] = jwt.decode(
            token.strip(),
            _chat_capability_secret(),
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        logger.info(
            "chat_capability_decode_failed app_id=%s session_id=%s error_type=%s",
            app.id,
            session_id,
            exc.__class__.__name__,
        )
        raise chat_unavailable_http_exception() from exc

    if payload.get("sid") != str(session_id):
        logger.info("chat_capability_sid_mismatch app_id=%s session_id=%s", app.id, session_id)
        raise chat_unavailable_http_exception()
    if payload.get("aid") != str(app.id):
        logger.info("chat_capability_aid_mismatch app_id=%s session_id=%s", app.id, session_id)
        raise chat_unavailable_http_exception()

    try:
        token_version = int(payload.get("iv"))
    except (TypeError, ValueError):
        logger.info("chat_capability_version_invalid app_id=%s session_id=%s", app.id, session_id)
        raise chat_unavailable_http_exception()

    if token_version != int(app.integration_version):
        logger.info(
            "chat_capability_version_mismatch app_id=%s session_id=%s token_version=%s app_version=%s",
            app.id,
            session_id,
            token_version,
            app.integration_version,
        )
        raise chat_unavailable_http_exception()


def is_chat_unavailable_provider_error(exc: Exception) -> bool:
    status_code = _extract_status_code(exc)
    if status_code in {401, 402, 403, 429}:
        return True

    text = f"{exc.__class__.__name__} {exc}".lower()
    keywords = (
        "invalid api key",
        "invalid_api_key",
        "incorrect api key",
        "authentication error",
        "authenticationerror",
        "insufficient_quota",
        "insufficient quota",
        "quota exceeded",
        "credit",
        "credits",
        "no balance",
        "rate limit",
        "rate_limit",
        "ratelimit",
        "too many requests",
        "billing hard limit",
    )
    return any(keyword in text for keyword in keywords)


def _extract_status_code(exc: Exception) -> int | None:
    direct = getattr(exc, "status_code", None)
    if isinstance(direct, int):
        return direct

    response = getattr(exc, "response", None)
    if isinstance(response, Mapping):
        status_code = response.get("status_code")
        if isinstance(status_code, int):
            return status_code

    nested = getattr(response, "status_code", None)
    if isinstance(nested, int):
        return nested
    return None
