import uuid

from pydantic import BaseModel, Field


class OrganizationScopedRequest(BaseModel):
    organization_id: uuid.UUID


class KBGetRequest(OrganizationScopedRequest):
    kb_id: uuid.UUID


class KBCreateRequest(OrganizationScopedRequest):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    embedding_profile_id: uuid.UUID


class KBUpdateRequest(KBGetRequest):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    embedding_profile_id: uuid.UUID | None = None
    confirm_regeneration: bool = False


class KBEmbeddingChangeImpactRequest(KBGetRequest):
    embedding_profile_id: uuid.UUID


class SourceAddURLRequest(KBGetRequest):
    url: str = Field(min_length=1, max_length=2000)
    title: str | None = Field(default=None, max_length=255)


class SourceAddUploadRequest(KBGetRequest):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=2_000_000)


class SourceMutateRequest(KBGetRequest):
    source_id: uuid.UUID


class DocumentsListRequest(KBGetRequest):
    query: str | None = Field(default=None, max_length=255)
    limit: int = Field(default=50, ge=1, le=200)


class DocumentDeleteRequest(KBGetRequest):
    document_id: uuid.UUID


class SearchRequest(KBGetRequest):
    query: str = Field(min_length=1, max_length=2000)
    limit: int = Field(default=10, ge=1, le=50)
    exclude_modalities: list[str] = Field(default_factory=list, max_length=16)


class MultiKBSearchRequest(OrganizationScopedRequest):
    kb_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)
    query: str = Field(min_length=1, max_length=2000)
    limit: int = Field(default=10, ge=1, le=50)
    exclude_modalities: list[str] = Field(default_factory=list, max_length=16)


class EmbeddingProfileGetRequest(OrganizationScopedRequest):
    profile_id: uuid.UUID


class EmbeddingProfileCreateRequest(OrganizationScopedRequest):
    name: str = Field(min_length=1, max_length=120)
    llm_profile_id: uuid.UUID
    llm_profile_name: str = Field(min_length=1, max_length=120)
    provider: str = Field(min_length=1, max_length=64)
    embedding_model: str = Field(min_length=1, max_length=128)
    api_key: str = Field(min_length=1, max_length=4096)
    api_base: str | None = Field(default=None, max_length=255)


class EmbeddingProfileUpdateRequest(EmbeddingProfileGetRequest):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    llm_profile_id: uuid.UUID | None = None
    llm_profile_name: str | None = Field(default=None, min_length=1, max_length=120)
    provider: str | None = Field(default=None, min_length=1, max_length=64)
    embedding_model: str | None = Field(default=None, min_length=1, max_length=128)
    api_key: str | None = Field(default=None, min_length=1, max_length=4096)
    api_base: str | None = Field(default=None, max_length=255)
    confirm_regeneration: bool = False


class EmbeddingProfileChangeImpactRequest(EmbeddingProfileGetRequest):
    llm_profile_id: uuid.UUID | None = None
    provider: str | None = Field(default=None, min_length=1, max_length=64)
    embedding_model: str | None = Field(default=None, min_length=1, max_length=128)
    api_base: str | None = Field(default=None, max_length=255)
