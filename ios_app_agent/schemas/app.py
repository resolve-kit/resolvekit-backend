import uuid
from datetime import datetime

from pydantic import BaseModel


class AppCreate(BaseModel):
    name: str
    bundle_id: str | None = None


class AppUpdate(BaseModel):
    name: str | None = None
    bundle_id: str | None = None


class AppOut(BaseModel):
    id: uuid.UUID
    developer_id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    bundle_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreate(BaseModel):
    label: str = ""


class ApiKeyOut(BaseModel):
    id: uuid.UUID
    key_prefix: str
    label: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreated(ApiKeyOut):
    raw_key: str
