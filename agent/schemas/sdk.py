from datetime import datetime

from pydantic import BaseModel


class SDKCompatResponse(BaseModel):
    minimum_sdk_version: str
    supported_sdk_major_versions: list[int]
    client_requirements: list[str]
    server_time: str


class SDKClientTokenResponse(BaseModel):
    token: str
    expires_at: datetime
