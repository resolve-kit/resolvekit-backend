from datetime import datetime, timezone
from collections import defaultdict, deque
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from agent.config import settings
from agent.middleware.auth import get_app_from_api_key, get_app_from_sdk_auth
from agent.models.app import App
from agent.schemas.chat_theme import ChatThemeOut
from agent.schemas.sdk import SDKClientTokenResponse, SDKCompatResponse
from agent.services.chat_theme_service import default_chat_theme, normalize_chat_theme
from agent.services.sdk_client_token_service import issue_sdk_client_token

router = APIRouter(prefix="/v1/sdk", tags=["sdk"])
_sdk_client_token_rate_limit: dict[str, deque[float]] = defaultdict(deque)


def _normalize_origin(value: str) -> str:
    return value.strip().rstrip("/")


def _is_allowed_origin(origin: str) -> bool:
    allowed = {_normalize_origin(item) for item in settings.cors_origins}
    return _normalize_origin(origin) in allowed


def _enforce_client_token_rate_limit(*, app_id: str, client_host: str) -> None:
    now = time.time()
    window_seconds = 60.0
    limit = max(1, int(settings.sdk_client_token_rate_limit_per_minute))
    key = f"{app_id}:{client_host}"
    bucket = _sdk_client_token_rate_limit[key]

    while bucket and (now - bucket[0]) >= window_seconds:
        bucket.popleft()

    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Client token rate limit exceeded",
        )

    bucket.append(now)


@router.get("/compat", response_model=SDKCompatResponse)
async def get_sdk_compatibility(
    app: App = Depends(get_app_from_sdk_auth),
):
    _ = app
    return SDKCompatResponse(
        minimum_sdk_version=settings.minimum_sdk_version,
        supported_sdk_major_versions=settings.supported_sdk_major_versions,
        client_requirements=["client.platform", "client.os_version", "client.app_version"],
        server_time=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/chat-theme", response_model=ChatThemeOut)
async def get_chat_theme(
    app: App = Depends(get_app_from_sdk_auth),
):
    raw_theme = app.chat_theme or default_chat_theme()
    return ChatThemeOut(**normalize_chat_theme(raw_theme))


@router.post("/client-token", response_model=SDKClientTokenResponse)
async def create_sdk_client_token(
    request: Request,
    response: Response,
    app: App = Depends(get_app_from_api_key),
):
    origin = request.headers.get("origin")
    if origin and not _is_allowed_origin(origin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Origin not allowed")

    client_host = request.client.host if request.client else "unknown"
    _enforce_client_token_rate_limit(app_id=str(app.id), client_host=client_host)

    token, expires_at = issue_sdk_client_token(app)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Vary"] = "Origin"
    return SDKClientTokenResponse(token=token, expires_at=expires_at)
