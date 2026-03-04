from datetime import datetime, timedelta, timezone
import uuid

from fastapi import HTTPException, status
from jose import JWTError, jwt

from agent.config import settings
from agent.models.app import App

INVALID_SDK_CLIENT_TOKEN_DETAIL = "Invalid client token"
SDK_CLIENT_TOKEN_TYPE = "sdk_client"


def _sdk_client_token_secret() -> str:
    return settings.sdk_client_token_secret or settings.jwt_secret


def _sdk_client_token_http_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=INVALID_SDK_CLIENT_TOKEN_DETAIL,
    )


def issue_sdk_client_token(
    app: App,
    ttl_seconds: int | None = None,
) -> tuple[str, datetime]:
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(seconds=ttl_seconds or settings.sdk_client_token_ttl_seconds)
    payload = {
        "aid": str(app.id),
        "typ": SDK_CLIENT_TOKEN_TYPE,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
        "v": int(app.integration_version or 1),
    }
    token = jwt.encode(payload, _sdk_client_token_secret(), algorithm=settings.jwt_algorithm)
    return token, expires_at


def resolve_sdk_client_token_app_id(
    token: str | None,
    app: App | None = None,
) -> uuid.UUID:
    if token is None or not str(token).strip():
        raise _sdk_client_token_http_exception()

    try:
        payload = jwt.decode(
            str(token),
            _sdk_client_token_secret(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "aid", "typ"]},
        )
    except JWTError as exc:
        raise _sdk_client_token_http_exception() from exc

    if payload.get("typ") != SDK_CLIENT_TOKEN_TYPE:
        raise _sdk_client_token_http_exception()

    try:
        app_id = uuid.UUID(str(payload.get("aid", "")))
    except ValueError as exc:
        raise _sdk_client_token_http_exception() from exc

    if app is not None:
        if app_id != app.id:
            raise _sdk_client_token_http_exception()
        token_version = int(payload.get("v", 1))
        app_version = int(app.integration_version or 1)
        if token_version != app_version:
            raise _sdk_client_token_http_exception()

    return app_id
