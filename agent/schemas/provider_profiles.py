import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from agent.schemas.agent_config import ModelInfo


class OrganizationLLMProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    provider: str = Field(min_length=1, max_length=50)
    api_key: str = Field(min_length=1, max_length=4096)
    api_base: str | None = Field(default=None, max_length=255)


class OrganizationLLMProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    provider: str | None = Field(default=None, min_length=1, max_length=50)
    api_key: str | None = Field(default=None, min_length=1, max_length=4096)
    api_base: str | None = Field(default=None, max_length=255)


class OrganizationLLMProfileOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    provider: str
    has_api_key: bool
    api_base: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrganizationLlmModelsOut(BaseModel):
    llm_profile_id: uuid.UUID
    provider: str
    models: list[ModelInfo]
    is_dynamic: bool
    error: str | None = None


class OrganizationEmbeddingModelsOut(BaseModel):
    llm_profile_id: uuid.UUID
    provider: str
    models: list[ModelInfo]
    is_dynamic: bool
    error: str | None = None
