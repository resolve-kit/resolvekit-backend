import uuid

from pydantic import BaseModel


class AgentConfigUpdate(BaseModel):
    system_prompt: str | None = None
    llm_profile_id: uuid.UUID | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    max_tool_rounds: int | None = None
    session_ttl_minutes: int | None = None
    max_context_messages: int | None = None


class AgentConfigOut(BaseModel):
    id: uuid.UUID
    app_id: uuid.UUID
    system_prompt: str
    llm_profile_id: uuid.UUID | None
    llm_profile_name: str | None
    llm_provider: str | None
    llm_model: str | None
    has_llm_api_key: bool
    llm_api_base: str | None
    temperature: float
    max_tokens: int
    max_tool_rounds: int
    session_ttl_minutes: int
    max_context_messages: int

    model_config = {"from_attributes": True}


class ProviderInfo(BaseModel):
    id: str
    name: str
    custom_base_url: bool = False


class ModelInfo(BaseModel):
    id: str
    name: str


class ModelsResponse(BaseModel):
    provider: str
    models: list[ModelInfo]
    is_dynamic: bool
    error: str | None = None


class ModelsLookupRequest(BaseModel):
    provider: str | None = None
    llm_api_key: str | None = None
    llm_api_base: str | None = None


class ConnectionTestRequest(BaseModel):
    provider: str
    model: str | None = None
    llm_api_key: str | None = None
    llm_api_base: str | None = None


class ConnectionTestResult(BaseModel):
    ok: bool
    latency_ms: int | None
    error: str | None
