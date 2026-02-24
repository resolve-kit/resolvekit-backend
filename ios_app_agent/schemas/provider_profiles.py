import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class OrganizationLLMProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    provider: str = Field(min_length=1, max_length=50)
    model: str = Field(min_length=1, max_length=128)
    api_key: str = Field(min_length=1, max_length=4096)
    api_base: str | None = Field(default=None, max_length=255)


class OrganizationLLMProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    provider: str | None = Field(default=None, min_length=1, max_length=50)
    model: str | None = Field(default=None, min_length=1, max_length=128)
    api_key: str | None = Field(default=None, min_length=1, max_length=4096)
    api_base: str | None = Field(default=None, max_length=255)


class OrganizationLLMProfileOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    provider: str
    model: str
    has_api_key: bool
    api_base: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
