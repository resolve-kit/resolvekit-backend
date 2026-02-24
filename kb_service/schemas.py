import uuid

from pydantic import BaseModel, Field


class OrganizationScopedRequest(BaseModel):
    organization_id: uuid.UUID


class KBGetRequest(OrganizationScopedRequest):
    kb_id: uuid.UUID


class KBCreateRequest(OrganizationScopedRequest):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class KBUpdateRequest(KBGetRequest):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


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


class MultiKBSearchRequest(OrganizationScopedRequest):
    kb_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)
    query: str = Field(min_length=1, max_length=2000)
    limit: int = Field(default=10, ge=1, le=50)


class EmbeddingConfigPutRequest(OrganizationScopedRequest):
    provider: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=128)
    api_key: str = Field(min_length=1, max_length=4096)
