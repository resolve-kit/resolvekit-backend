from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from agent.config import settings
from agent.middleware.auth import get_app_from_api_key
from agent.models.app import App
from agent.schemas.chat_theme import ChatThemeOut
from agent.schemas.sdk import SDKCompatResponse
from agent.services.chat_theme_service import default_chat_theme, normalize_chat_theme

router = APIRouter(prefix="/v1/sdk", tags=["sdk"])


@router.get("/compat", response_model=SDKCompatResponse)
async def get_sdk_compatibility(
    app: App = Depends(get_app_from_api_key),
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
    app: App = Depends(get_app_from_api_key),
):
    raw_theme = app.chat_theme or default_chat_theme()
    return ChatThemeOut(**normalize_chat_theme(raw_theme))
