import uuid
from datetime import datetime
import json
from typing import Any

from pydantic import BaseModel, Field, field_validator

MAX_LLM_CONTEXT_KEYS = 50
MAX_LLM_CONTEXT_KEY_LENGTH = 64
MAX_LLM_CONTEXT_BYTES = 8192


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
    llm_context: dict[str, Any] = Field(default_factory=dict)
    entitlements: list[str] = Field(default_factory=list, max_length=64)
    capabilities: list[str] = Field(default_factory=list, max_length=64)

    @field_validator("llm_context")
    @classmethod
    def validate_llm_context(cls, value: dict[str, Any] | None) -> dict[str, Any]:
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError("llm_context must be a JSON object")
        if len(value) > MAX_LLM_CONTEXT_KEYS:
            raise ValueError(f"llm_context must have at most {MAX_LLM_CONTEXT_KEYS} top-level keys")

        for key in value:
            if not isinstance(key, str):
                raise ValueError("llm_context keys must be strings")
            if len(key) > MAX_LLM_CONTEXT_KEY_LENGTH:
                raise ValueError(f"llm_context keys must be <= {MAX_LLM_CONTEXT_KEY_LENGTH} chars")

        try:
            serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        except TypeError as exc:
            raise ValueError("llm_context must be JSON-serializable") from exc

        if len(serialized.encode("utf-8")) > MAX_LLM_CONTEXT_BYTES:
            raise ValueError(f"llm_context must not exceed {MAX_LLM_CONTEXT_BYTES} bytes")

        return value


class SessionOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    device_id: str | None
    client_context: dict[str, Any] | None = None
    llm_context: dict[str, Any] | None = None
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
