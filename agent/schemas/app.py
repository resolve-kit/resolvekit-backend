import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AppCreate(BaseModel):
    name: str
    bundle_id: str | None = None


class AppUpdate(BaseModel):
    name: str | None = None
    bundle_id: str | None = None
    integration_enabled: bool | None = None


class AppOut(BaseModel):
    id: uuid.UUID
    developer_id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    bundle_id: str | None
    integration_enabled: bool
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


class ChatLocalizationTexts(BaseModel):
    chat_title: str = Field(min_length=1, max_length=120)
    message_placeholder: str = Field(min_length=1, max_length=200)
    initial_message: str = Field(min_length=1, max_length=1000)


class ChatLocalizationOverrideTexts(BaseModel):
    chat_title: str | None = Field(default=None, min_length=1, max_length=120)
    message_placeholder: str | None = Field(default=None, min_length=1, max_length=200)
    initial_message: str | None = Field(default=None, min_length=1, max_length=1000)


class ChatLocalizationLocaleInfo(BaseModel):
    code: str
    language: str
    local_name: str


class ChatLocalizationCatalogItem(BaseModel):
    locale: ChatLocalizationLocaleInfo
    defaults: ChatLocalizationTexts
    effective: ChatLocalizationTexts
    overrides: ChatLocalizationOverrideTexts | None = None


class ChatLocalizationsOut(BaseModel):
    locales: list[ChatLocalizationCatalogItem]


class ChatLocalizationsUpdate(BaseModel):
    overrides: dict[str, ChatLocalizationTexts] = Field(default_factory=dict)
