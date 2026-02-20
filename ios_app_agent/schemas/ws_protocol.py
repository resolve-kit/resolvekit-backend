from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class WSEnvelope(BaseModel):
    type: str
    request_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Client -> Server
class ChatMessagePayload(BaseModel):
    text: str


class ToolResultPayload(BaseModel):
    call_id: str
    status: str  # "success" or "error"
    result: Any | None = None
    error: str | None = None


# Server -> Client
class TextDeltaPayload(BaseModel):
    delta: str
    accumulated: str


class ToolCallRequestPayload(BaseModel):
    call_id: str
    function_name: str
    arguments: dict[str, Any]
    timeout_seconds: int
    human_description: str = ""


class TurnCompletePayload(BaseModel):
    full_text: str
    usage: dict[str, Any] | None = None


class ErrorPayload(BaseModel):
    code: str
    message: str
    recoverable: bool = True
