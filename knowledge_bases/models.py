import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class OrganizationEmbeddingProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organization_embedding_profiles"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_org_embedding_profile_name"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(120))
    llm_profile_id: Mapped[uuid.UUID] = mapped_column(index=True)
    llm_profile_name: Mapped[str] = mapped_column(String(120))
    provider: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(128))
    api_key_encrypted: Mapped[str] = mapped_column(Text)
    api_base: Mapped[str | None] = mapped_column(String(255), nullable=True)


class KnowledgeBase(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_bases"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_knowledge_bases_org_name"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    summary_llm_profile_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    summary_llm_profile_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    summary_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    summary_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    summary_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_api_base: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_topics_json: Mapped[list[str]] = mapped_column(JSONB, default=list)
    summary_status: Mapped[str] = mapped_column(String(32), default="disabled")
    summary_last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary_content_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Active embedding runtime for this knowledge base.
    embedding_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organization_embedding_profiles.id", ondelete="SET NULL"),
        index=True,
    )
    embedding_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    embedding_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding_api_base: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Pending embedding runtime used by regeneration jobs.
    pending_embedding_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organization_embedding_profiles.id", ondelete="SET NULL"),
        index=True,
    )
    pending_embedding_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pending_embedding_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    pending_embedding_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    pending_embedding_api_base: Mapped[str | None] = mapped_column(String(255), nullable=True)

    embedding_regeneration_status: Mapped[str] = mapped_column(String(32), default="idle")
    embedding_regeneration_error: Mapped[str | None] = mapped_column(Text)

    sources: Mapped[list["KnowledgeSource"]] = relationship(
        back_populates="knowledge_base",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list["KnowledgeDocument"]] = relationship(
        back_populates="knowledge_base",
        cascade="all, delete-orphan",
    )


class KnowledgeSource(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_sources"

    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        index=True,
    )
    source_type: Mapped[str] = mapped_column(String(16))  # url | upload
    input_url: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(String(255))
    upload_content: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)

    knowledge_base: Mapped["KnowledgeBase"] = relationship(back_populates="sources")
    documents: Mapped[list["KnowledgeDocument"]] = relationship(
        back_populates="source",
        cascade="all, delete-orphan",
    )


class KnowledgeDocument(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_documents"
    __table_args__ = (
        UniqueConstraint(
            "knowledge_base_id",
            "canonical_url",
            name="uq_knowledge_documents_kb_url",
        ),
    )

    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        index=True,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_sources.id", ondelete="CASCADE"),
        index=True,
    )
    canonical_url: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(String(255))
    content_markdown: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    knowledge_base: Mapped["KnowledgeBase"] = relationship(back_populates="documents")
    source: Mapped["KnowledgeSource"] = relationship(back_populates="documents")
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )
    image_assets: Mapped[list["KnowledgeImageAsset"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )


class KnowledgeChunk(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_chunks"

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
        index=True,
    )
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(index=True)
    chunk_index: Mapped[int] = mapped_column()
    content_text: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column()
    embedding: Mapped[list[float] | None] = mapped_column(JSONB)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    document: Mapped["KnowledgeDocument"] = relationship(back_populates="chunks")


class KnowledgeImageAsset(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_image_assets"

    organization_id: Mapped[uuid.UUID] = mapped_column(index=True)
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(index=True)
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_sources.id", ondelete="CASCADE"),
        index=True,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
        index=True,
    )
    source_image_url: Mapped[str] = mapped_column(Text)
    storage_path: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    mime_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    byte_size: Mapped[int] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dom_index: Mapped[int] = mapped_column(Integer)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    parent_document_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="ready")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    document: Mapped["KnowledgeDocument"] = relationship(back_populates="image_assets")


class KnowledgeIngestionJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_ingestion_jobs"

    organization_id: Mapped[uuid.UUID] = mapped_column(index=True)
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(index=True)
    source_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    target_embedding_profile_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    job_type: Mapped[str] = mapped_column(String(32), default="ingest_source")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    error: Mapped[str | None] = mapped_column(Text)
    stats_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LLMUsageEvent(Base, UUIDMixin):
    __tablename__ = "llm_usage_events"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(index=True)
    knowledge_base_id: Mapped[uuid.UUID | None] = mapped_column(index=True, nullable=True)
    app_id: Mapped[uuid.UUID | None] = mapped_column(index=True, nullable=True)
    provider: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(200))
    operation: Mapped[str] = mapped_column(String(64))
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
