from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ios_app_agent.config import settings
from ios_app_agent.middleware.auth import get_app_from_api_key
from ios_app_agent.models.app import App
from ios_app_agent.schemas.sdk import SDKCompatResponse

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
