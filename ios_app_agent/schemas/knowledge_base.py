import uuid

from pydantic import BaseModel, Field


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    embedding_profile_id: uuid.UUID


class KnowledgeBaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    embedding_profile_id: uuid.UUID | None = None
    confirm_regeneration: bool = False


class KnowledgeBaseEmbeddingChangeImpactRequest(BaseModel):
    embedding_profile_id: uuid.UUID


class KnowledgeSourceURLCreate(BaseModel):
    url: str = Field(min_length=1, max_length=2000)
    title: str | None = Field(default=None, max_length=255)


class KnowledgeSourceUploadCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=2_000_000)


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    limit: int = Field(default=10, ge=1, le=50)


class KnowledgeDocumentListRequest(BaseModel):
    query: str | None = Field(default=None, max_length=255)
    limit: int = Field(default=50, ge=1, le=200)


class AppKnowledgeBaseAssignmentsUpdate(BaseModel):
    knowledge_base_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)


class OrganizationEmbeddingProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    provider: str = Field(min_length=1, max_length=64)
    model: str = Field(min_length=1, max_length=128)
    api_key: str = Field(min_length=1, max_length=4096)
    api_base: str | None = Field(default=None, max_length=255)


class OrganizationEmbeddingProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    provider: str | None = Field(default=None, min_length=1, max_length=64)
    model: str | None = Field(default=None, min_length=1, max_length=128)
    api_key: str | None = Field(default=None, min_length=1, max_length=4096)
    api_base: str | None = Field(default=None, max_length=255)
    confirm_regeneration: bool = False


class OrganizationEmbeddingProfileChangeImpactRequest(BaseModel):
    provider: str | None = Field(default=None, min_length=1, max_length=64)
    model: str | None = Field(default=None, min_length=1, max_length=128)
    api_base: str | None = Field(default=None, max_length=255)
