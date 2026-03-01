import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from knowledge_bases.models import (
    KnowledgeBase,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeImageAsset,
    KnowledgeIngestionJob,
    KnowledgeSource,
)
from knowledge_bases.services.crawling import CrawledPage, canonicalize_url, crawl_site
from knowledge_bases.services.embedding import EmbeddingRuntimeConfig
from knowledge_bases.services.embedding import embed_texts
from knowledge_bases.services.embedding_runtime import runtime_from_kb_active, runtime_from_kb_pending
from knowledge_bases.services.multimodal import (
    download_image_bytes,
    extract_ocr_text,
    generate_caption_with_vision_model,
    persist_image_asset,
    remove_asset_file,
    select_relevant_images,
)
from knowledge_bases.config import settings
from knowledge_bases.services.summary_index import refresh_kb_summary_index


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


def deduplicate_pages_by_hash(
    pages: list[CrawledPage],
    *,
    existing_hashes: set[str] | None = None,
) -> tuple[list[tuple[CrawledPage, str]], int]:
    seen_hashes = set(existing_hashes or set())
    deduped_pages: list[tuple[CrawledPage, str]] = []
    skipped_duplicates = 0

    for page in pages:
        markdown = page.content_markdown.strip()
        if not markdown:
            continue
        content_hash = _hash_content(markdown)
        if content_hash in seen_hashes:
            skipped_duplicates += 1
            continue
        seen_hashes.add(content_hash)
        deduped_pages.append((page, content_hash))

    return deduped_pages, skipped_duplicates


async def build_image_assets_and_chunks(
    *,
    organization_id: uuid.UUID,
    knowledge_base_id: uuid.UUID,
    source_id: uuid.UUID,
    document: KnowledgeDocument,
    page: CrawledPage,
    runtime: EmbeddingRuntimeConfig | None,
    starting_chunk_index: int,
) -> tuple[list[KnowledgeImageAsset], list[KnowledgeChunk]]:
    selected = select_relevant_images(
        page.images,
        max_images=settings.multimodal_max_images_per_page,
    )
    assets: list[KnowledgeImageAsset] = []
    chunks: list[KnowledgeChunk] = []
    next_chunk_index = starting_chunk_index

    for ranked in selected:
        image = ranked.image
        downloaded = await download_image_bytes(image.url)
        if downloaded is None:
            continue
        image_bytes, content_type = downloaded
        storage_path, content_hash, resolved_content_type = persist_image_asset(
            organization_id=organization_id,
            knowledge_base_id=knowledge_base_id,
            source_url=image.url,
            image_bytes=image_bytes,
            content_type=content_type,
        )
        ocr_text = extract_ocr_text(image_bytes)
        caption_text = await generate_caption_with_vision_model(
            runtime=runtime,
            image_bytes=image_bytes,
            mime_type=resolved_content_type,
            context_text=image.context_text,
        )

        asset = KnowledgeImageAsset(
            organization_id=organization_id,
            knowledge_base_id=knowledge_base_id,
            source_id=source_id,
            document_id=document.id,
            source_image_url=image.url,
            storage_path=storage_path,
            content_hash=content_hash,
            mime_type=resolved_content_type,
            byte_size=len(image_bytes),
            width=image.width,
            height=image.height,
            dom_index=image.dom_index,
            relevance_score=ranked.score,
            parent_document_url=page.url,
            ocr_text=ocr_text or None,
            caption_text=caption_text or None,
            status="ready",
            last_error=None,
            metadata_json={
                "section_heading": image.section_heading,
                "context_text": image.context_text,
                "in_chrome": image.in_chrome,
            },
        )
        assets.append(asset)

        chunk_specs: list[tuple[str, str]] = []
        if ocr_text:
            chunk_specs.append(("image_ocr", ocr_text))
        if caption_text:
            chunk_specs.append(("image_caption", caption_text))
        if not chunk_specs:
            continue
        embeddings = await embed_texts([item[1] for item in chunk_specs], runtime)
        for (modality, chunk_text_value), embedding in zip(chunk_specs, embeddings):
            chunk = KnowledgeChunk(
                document_id=document.id,
                knowledge_base_id=knowledge_base_id,
                chunk_index=next_chunk_index,
                content_text=chunk_text_value,
                token_count=max(1, len(chunk_text_value.split())),
                embedding=embedding,
                metadata_json={
                    "canonical_url": page.url,
                    "title": page.title[:255] if page.title else None,
                    "modality": modality,
                    "image_asset_path": storage_path,
                    "image_source_url": image.url,
                    "section_heading": image.section_heading,
                    "dom_index": image.dom_index,
                    "parent_document_id": str(document.id),
                    "parent_canonical_url": page.url,
                },
            )
            chunks.append(chunk)
            next_chunk_index += 1

    return assets, chunks


async def cleanup_image_assets_for_source(
    db: AsyncSession,
    *,
    source_id: uuid.UUID,
) -> int:
    existing_assets_result = await db.execute(
        select(KnowledgeImageAsset).where(KnowledgeImageAsset.source_id == source_id)
    )
    existing_assets = existing_assets_result.scalars().all()
    for asset in existing_assets:
        remove_asset_file(asset.storage_path)
    if existing_assets:
        await db.execute(delete(KnowledgeImageAsset).where(KnowledgeImageAsset.source_id == source_id))
    return len(existing_assets)


async def cleanup_image_assets_for_document(
    db: AsyncSession,
    *,
    document_id: uuid.UUID,
) -> int:
    existing_assets_result = await db.execute(
        select(KnowledgeImageAsset).where(KnowledgeImageAsset.document_id == document_id)
    )
    existing_assets = existing_assets_result.scalars().all()
    for asset in existing_assets:
        remove_asset_file(asset.storage_path)
    if existing_assets:
        await db.execute(delete(KnowledgeImageAsset).where(KnowledgeImageAsset.document_id == document_id))
    return len(existing_assets)


async def _process_source_ingestion_job(db: AsyncSession, job: KnowledgeIngestionJob) -> None:
    if not job.source_id:
        raise ValueError("Ingestion job missing source")

    source = await db.get(KnowledgeSource, job.source_id)
    if not source or source.knowledge_base_id != job.knowledge_base_id:
        raise ValueError("Source not found")

    kb = await db.get(KnowledgeBase, job.knowledge_base_id)
    if not kb or kb.organization_id != job.organization_id:
        raise ValueError("Knowledge base not found")

    pages = await _materialize_source_documents(source)

    # Remove previously ingested docs/chunks/assets for this source to keep recrawl idempotent.
    existing_docs_result = await db.execute(
        select(KnowledgeDocument.id).where(KnowledgeDocument.source_id == source.id)
    )
    existing_doc_ids = [doc_id for doc_id in existing_docs_result.scalars().all()]
    await cleanup_image_assets_for_source(db, source_id=source.id)
    if existing_doc_ids:
        await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.document_id.in_(existing_doc_ids)))
        await db.execute(delete(KnowledgeDocument).where(KnowledgeDocument.id.in_(existing_doc_ids)))
        await db.flush()

    existing_hashes_result = await db.execute(
        select(KnowledgeDocument.content_hash).where(
            KnowledgeDocument.knowledge_base_id == job.knowledge_base_id
        )
    )
    existing_hashes = {
        content_hash
        for content_hash in existing_hashes_result.scalars().all()
        if isinstance(content_hash, str)
    }
    deduplicated_pages, skipped_duplicates = deduplicate_pages_by_hash(
        pages,
        existing_hashes=existing_hashes,
    )

    runtime = runtime_from_kb_active(kb)

    total_chunks = 0
    total_docs = 0
    total_images = 0
    for page, content_hash in deduplicated_pages:
        markdown = page.content_markdown.strip()
        doc = KnowledgeDocument(
            knowledge_base_id=job.knowledge_base_id,
            source_id=source.id,
            canonical_url=page.url,
            title=page.title[:255] if page.title else None,
            content_markdown=markdown,
            content_hash=content_hash,
            metadata_json={"source_type": source.source_type},
        )
        db.add(doc)
        await db.flush()

        chunks = chunk_text(markdown)
        embeddings = await embed_texts(chunks, runtime)
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

        image_assets, image_chunks = await build_image_assets_and_chunks(
            organization_id=job.organization_id,
            knowledge_base_id=job.knowledge_base_id,
            source_id=source.id,
            document=doc,
            page=page,
            runtime=runtime,
            starting_chunk_index=len(chunks),
        )
        for asset in image_assets:
            db.add(asset)
        for image_chunk in image_chunks:
            db.add(image_chunk)
            total_chunks += 1
        total_images += len(image_assets)
        total_docs += 1

    source.status = "ready"
    source.last_crawled_at = datetime.now(timezone.utc)
    source.last_error = None
    await refresh_kb_summary_index(db, kb=kb)
    job.stats_json = {
        "documents": total_docs,
        "chunks": total_chunks,
        "images": total_images,
        "duplicates_skipped": skipped_duplicates,
        "summary_status": kb.summary_status,
    }


async def _process_reembedding_job(db: AsyncSession, job: KnowledgeIngestionJob) -> None:
    kb = await db.get(KnowledgeBase, job.knowledge_base_id)
    if kb is None or kb.organization_id != job.organization_id:
        raise ValueError("Knowledge base not found")
    if kb.pending_embedding_profile_id is None:
        raise ValueError("No pending embedding profile to apply")

    runtime = runtime_from_kb_pending(kb)
    chunks_result = await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.knowledge_base_id == job.knowledge_base_id)
        .order_by(KnowledgeChunk.document_id.asc(), KnowledgeChunk.chunk_index.asc())
    )
    chunks = chunks_result.scalars().all()

    if chunks:
        texts = [chunk.content_text for chunk in chunks]
        embeddings = await embed_texts(texts, runtime)
        for chunk, embedding in zip(chunks, embeddings):
            chunk.embedding = embedding

    kb.embedding_profile_id = kb.pending_embedding_profile_id
    kb.embedding_provider = kb.pending_embedding_provider
    kb.embedding_model = kb.pending_embedding_model
    kb.embedding_api_key_encrypted = kb.pending_embedding_api_key_encrypted
    kb.embedding_api_base = kb.pending_embedding_api_base

    kb.pending_embedding_profile_id = None
    kb.pending_embedding_provider = None
    kb.pending_embedding_model = None
    kb.pending_embedding_api_key_encrypted = None
    kb.pending_embedding_api_base = None
    kb.embedding_regeneration_status = "idle"
    kb.embedding_regeneration_error = None

    doc_count_result = await db.execute(
        select(KnowledgeDocument.id).where(KnowledgeDocument.knowledge_base_id == job.knowledge_base_id)
    )
    document_count = len(doc_count_result.scalars().all())
    estimated_tokens = sum(chunk.token_count for chunk in chunks)
    job.stats_json = {
        "documents": document_count,
        "chunks": len(chunks),
        "estimated_tokens": estimated_tokens,
    }


async def _process_refresh_kb_index_job(db: AsyncSession, job: KnowledgeIngestionJob) -> None:
    kb = await db.get(KnowledgeBase, job.knowledge_base_id)
    if kb is None or kb.organization_id != job.organization_id:
        raise ValueError("Knowledge base not found")
    await refresh_kb_summary_index(db, kb=kb)
    job.stats_json = {
        "summary_status": kb.summary_status,
        "summary_updated_at": kb.summary_updated_at.isoformat() if kb.summary_updated_at else None,
    }


async def process_ingestion_job(db: AsyncSession, job: KnowledgeIngestionJob) -> None:
    if job.job_type == "reembed_kb":
        await _process_reembedding_job(db, job)
        return
    if job.job_type == "refresh_kb_index":
        await _process_refresh_kb_index_job(db, job)
        return
    await _process_source_ingestion_job(db, job)


async def enqueue_ingestion_job(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    knowledge_base_id: uuid.UUID,
    source_id: uuid.UUID | None = None,
    job_type: str = "ingest_source",
    target_embedding_profile_id: uuid.UUID | None = None,
) -> KnowledgeIngestionJob:
    job = KnowledgeIngestionJob(
        organization_id=organization_id,
        knowledge_base_id=knowledge_base_id,
        source_id=source_id,
        target_embedding_profile_id=target_embedding_profile_id,
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
        "target_embedding_profile_id": (
            str(job.target_embedding_profile_id) if job.target_embedding_profile_id else None
        ),
        "job_type": job.job_type,
        "status": job.status,
        "error": job.error,
        "stats": job.stats_json or {},
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat(),
    }
