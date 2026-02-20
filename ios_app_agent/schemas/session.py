import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SessionClientInfo(BaseModel):
    platform: str | None = None
    os_name: str | None = None
    os_version: str | None = None
    app_version: str | None = None
    app_build: str | None = None
    sdk_name: str | None = None
    sdk_version: str | None = None


class SessionCreate(BaseModel):
    device_id: str | None = None
    metadata: dict[str, Any] = {}
    client: SessionClientInfo | None = None
    entitlements: list[str] = []
    capabilities: list[str] = []


class SessionOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    device_id: str | None
    status: str
    last_activity_at: datetime
    created_at: datetime
    ws_url: str | None = None

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    sequence_number: int
    role: str
    content: str | None
    tool_calls: dict[str, Any] | None
    tool_call_id: str | None
    token_count: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
