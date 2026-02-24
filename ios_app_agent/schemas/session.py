import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SessionClientInfo(BaseModel):
    platform: str | None = Field(default=None, max_length=32)
    os_name: str | None = Field(default=None, max_length=32)
    os_version: str | None = Field(default=None, max_length=64)
    app_version: str | None = Field(default=None, max_length=64)
    app_build: str | None = Field(default=None, max_length=64)
    sdk_name: str | None = Field(default=None, max_length=64)
    sdk_version: str | None = Field(default=None, max_length=64)


class SessionCreate(BaseModel):
    device_id: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)
    client: SessionClientInfo | None = None
    entitlements: list[str] = Field(default_factory=list, max_length=64)
    capabilities: list[str] = Field(default_factory=list, max_length=64)


class SessionOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    device_id: str | None
    client_context: dict[str, Any] | None = None
    status: str
    last_activity_at: datetime
    created_at: datetime
    ws_url: str | None = None
    chat_capability_token: str | None = None

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    sequence_number: int
    role: str
    content: str | None
    tool_calls: list[dict[str, Any]] | dict[str, Any] | None
    tool_call_id: str | None
    token_count: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionWSTicketOut(BaseModel):
    ws_url: str
    ws_ticket: str
    expires_at: datetime
