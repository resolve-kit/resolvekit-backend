import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from kb_service.models import (
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeIngestionJob,
    KnowledgeSource,
)
from kb_service.services.crawling import CrawledPage, canonicalize_url, crawl_site
from kb_service.services.embedding import embed_texts


def chunk_text(text: str, *, chunk_size: int = 1100, overlap: int = 160) -> list[str]:
    text = text.strip()
    if not text:
        return []

    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        start = max(0, end - overlap)
    return chunks


def _hash_content(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


async def _materialize_source_documents(source: KnowledgeSource) -> list[CrawledPage]:
    if source.source_type == "upload":
        content = (source.upload_content or "").strip()
        if not content:
            return []
        return [
            CrawledPage(
                url=f"upload://{source.id}",
                title=source.title or "Uploaded Content",
                content_markdown=content,
            )
        ]

    if not source.input_url:
        return []
    return await crawl_site(canonicalize_url(source.input_url))


async def process_ingestion_job(db: AsyncSession, job: KnowledgeIngestionJob) -> None:
    if not job.source_id:
        raise ValueError("Ingestion job missing source")

    source = await db.get(KnowledgeSource, job.source_id)
    if not source or source.knowledge_base_id != job.knowledge_base_id:
        raise ValueError("Source not found")

    pages = await _materialize_source_documents(source)

    # Remove previously ingested docs/chunks for this source to keep recrawl idempotent.
    existing_docs_result = await db.execute(
        select(KnowledgeDocument.id).where(KnowledgeDocument.source_id == source.id)
    )
    existing_doc_ids = [doc_id for doc_id in existing_docs_result.scalars().all()]
    if existing_doc_ids:
        await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.document_id.in_(existing_doc_ids)))
        await db.execute(delete(KnowledgeDocument).where(KnowledgeDocument.id.in_(existing_doc_ids)))
        await db.flush()

    total_chunks = 0
    total_docs = 0
    for page in pages:
        markdown = page.content_markdown.strip()
        if not markdown:
            continue
        doc = KnowledgeDocument(
            knowledge_base_id=job.knowledge_base_id,
            source_id=source.id,
            canonical_url=page.url,
            title=page.title[:255] if page.title else None,
            content_markdown=markdown,
            content_hash=_hash_content(markdown),
            metadata_json={"source_type": source.source_type},
        )
        db.add(doc)
        await db.flush()

        chunks = chunk_text(markdown)
        embeddings = await embed_texts(db, job.organization_id, chunks)
        for idx, (chunk_text_value, embedding) in enumerate(zip(chunks, embeddings)):
            chunk = KnowledgeChunk(
                document_id=doc.id,
                knowledge_base_id=job.knowledge_base_id,
                chunk_index=idx,
                content_text=chunk_text_value,
                token_count=max(1, len(chunk_text_value.split())),
                embedding=embedding,
                metadata_json={
                    "canonical_url": page.url,
                    "title": page.title[:255] if page.title else None,
                },
            )
            db.add(chunk)
            total_chunks += 1
        total_docs += 1

    source.status = "ready"
    source.last_crawled_at = datetime.now(timezone.utc)
    source.last_error = None
    job.stats_json = {"documents": total_docs, "chunks": total_chunks}


async def enqueue_ingestion_job(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    knowledge_base_id: uuid.UUID,
    source_id: uuid.UUID,
    job_type: str = "ingest_source",
) -> KnowledgeIngestionJob:
    job = KnowledgeIngestionJob(
        organization_id=organization_id,
        knowledge_base_id=knowledge_base_id,
        source_id=source_id,
        job_type=job_type,
        status="pending",
        stats_json={},
    )
    db.add(job)
    await db.flush()
    return job


def serialize_job(job: KnowledgeIngestionJob) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "organization_id": str(job.organization_id),
        "knowledge_base_id": str(job.knowledge_base_id),
        "source_id": str(job.source_id) if job.source_id else None,
        "job_type": job.job_type,
        "status": job.status,
        "error": job.error,
        "stats": job.stats_json or {},
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat(),
    }
