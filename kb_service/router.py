import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from kb_service.auth import ServicePrincipal, get_service_principal
from kb_service.database import get_db
from kb_service.models import (
    KnowledgeBase,
    KnowledgeDocument,
    KnowledgeIngestionJob,
    KnowledgeSource,
    OrganizationEmbeddingConfig,
)
from kb_service.schemas import (
    DocumentDeleteRequest,
    DocumentsListRequest,
    EmbeddingConfigPutRequest,
    KBCreateRequest,
    KBGetRequest,
    KBUpdateRequest,
    MultiKBSearchRequest,
    OrganizationScopedRequest,
    SearchRequest,
    SourceAddUploadRequest,
    SourceAddURLRequest,
    SourceMutateRequest,
)
from kb_service.services.crypto import encrypt_secret
from kb_service.services.ingestion import enqueue_ingestion_job, serialize_job
from kb_service.services.search import search_chunks

router = APIRouter(prefix="/internal", tags=["kb-internal"])


def _ensure_org_scope(principal: ServicePrincipal, organization_id: uuid.UUID) -> None:
    if principal.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization scope mismatch")


def _serialize_kb(kb: KnowledgeBase) -> dict[str, Any]:
    return {
        "id": str(kb.id),
        "organization_id": str(kb.organization_id),
        "name": kb.name,
        "description": kb.description,
        "created_at": kb.created_at.isoformat(),
        "updated_at": kb.updated_at.isoformat(),
    }


def _serialize_source(source: KnowledgeSource) -> dict[str, Any]:
    return {
        "id": str(source.id),
        "knowledge_base_id": str(source.knowledge_base_id),
        "source_type": source.source_type,
        "input_url": source.input_url,
        "title": source.title,
        "status": source.status,
        "last_crawled_at": source.last_crawled_at.isoformat() if source.last_crawled_at else None,
        "last_error": source.last_error,
        "created_at": source.created_at.isoformat(),
        "updated_at": source.updated_at.isoformat(),
    }


def _serialize_document(document: KnowledgeDocument) -> dict[str, Any]:
    return {
        "id": str(document.id),
        "knowledge_base_id": str(document.knowledge_base_id),
        "source_id": str(document.source_id),
        "canonical_url": document.canonical_url,
        "title": document.title,
        "content_hash": document.content_hash,
        "created_at": document.created_at.isoformat(),
        "updated_at": document.updated_at.isoformat(),
    }


async def _get_kb_or_404(db: AsyncSession, organization_id: uuid.UUID, kb_id: uuid.UUID) -> KnowledgeBase:
    result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.organization_id == organization_id,
        )
    )
    kb = result.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return kb


@router.post("/kbs/list")
async def list_kbs(
    body: OrganizationScopedRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.organization_id == body.organization_id)
        .order_by(KnowledgeBase.created_at.desc())
    )
    return {"items": [_serialize_kb(kb) for kb in result.scalars().all()]}


@router.post("/kbs/create")
async def create_kb(
    body: KBCreateRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    kb = KnowledgeBase(
        organization_id=body.organization_id,
        name=body.name.strip(),
        description=body.description,
    )
    db.add(kb)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Knowledge base name already exists")
    await db.refresh(kb)
    return {"item": _serialize_kb(kb)}


@router.post("/kbs/get")
async def get_kb(
    body: KBGetRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    kb = await _get_kb_or_404(db, body.organization_id, body.kb_id)
    return {"item": _serialize_kb(kb)}


@router.post("/kbs/update")
async def update_kb(
    body: KBUpdateRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    kb = await _get_kb_or_404(db, body.organization_id, body.kb_id)
    if body.name is not None:
        kb.name = body.name.strip()
    if body.description is not None:
        kb.description = body.description
    await db.commit()
    await db.refresh(kb)
    return {"item": _serialize_kb(kb)}


@router.post("/kbs/delete")
async def delete_kb(
    body: KBGetRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    kb = await _get_kb_or_404(db, body.organization_id, body.kb_id)
    await db.delete(kb)
    await db.commit()
    return {"status": "ok"}


@router.post("/sources/list")
async def list_sources(
    body: KBGetRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    await _get_kb_or_404(db, body.organization_id, body.kb_id)
    result = await db.execute(
        select(KnowledgeSource)
        .where(KnowledgeSource.knowledge_base_id == body.kb_id)
        .order_by(KnowledgeSource.created_at.desc())
    )
    return {"items": [_serialize_source(source) for source in result.scalars().all()]}


@router.post("/sources/add-url", status_code=status.HTTP_201_CREATED)
async def add_url(
    body: SourceAddURLRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    kb = await _get_kb_or_404(db, body.organization_id, body.kb_id)
    source = KnowledgeSource(
        knowledge_base_id=kb.id,
        source_type="url",
        input_url=body.url.strip(),
        title=body.title,
        status="pending",
    )
    db.add(source)
    await db.flush()
    job = await enqueue_ingestion_job(
        db,
        organization_id=body.organization_id,
        knowledge_base_id=kb.id,
        source_id=source.id,
    )
    await db.commit()
    await db.refresh(source)
    await db.refresh(job)
    return {"source": _serialize_source(source), "job": serialize_job(job)}


@router.post("/sources/add-upload", status_code=status.HTTP_201_CREATED)
async def add_upload(
    body: SourceAddUploadRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    kb = await _get_kb_or_404(db, body.organization_id, body.kb_id)
    source = KnowledgeSource(
        knowledge_base_id=kb.id,
        source_type="upload",
        title=body.title,
        upload_content=body.content,
        status="pending",
    )
    db.add(source)
    await db.flush()
    job = await enqueue_ingestion_job(
        db,
        organization_id=body.organization_id,
        knowledge_base_id=kb.id,
        source_id=source.id,
    )
    await db.commit()
    await db.refresh(source)
    await db.refresh(job)
    return {"source": _serialize_source(source), "job": serialize_job(job)}


@router.post("/sources/recrawl")
async def recrawl(
    body: SourceMutateRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    await _get_kb_or_404(db, body.organization_id, body.kb_id)
    source = await db.get(KnowledgeSource, body.source_id)
    if not source or source.knowledge_base_id != body.kb_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    source.status = "pending"
    source.last_error = None
    job = await enqueue_ingestion_job(
        db,
        organization_id=body.organization_id,
        knowledge_base_id=body.kb_id,
        source_id=source.id,
        job_type="recrawl_source",
    )
    await db.commit()
    await db.refresh(source)
    await db.refresh(job)
    return {"source": _serialize_source(source), "job": serialize_job(job)}


@router.post("/sources/delete")
async def delete_source(
    body: SourceMutateRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    await _get_kb_or_404(db, body.organization_id, body.kb_id)
    source = await db.get(KnowledgeSource, body.source_id)
    if not source or source.knowledge_base_id != body.kb_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    await db.delete(source)
    await db.commit()
    return {"status": "ok"}


@router.post("/jobs/list")
async def list_jobs(
    body: KBGetRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    await _get_kb_or_404(db, body.organization_id, body.kb_id)
    result = await db.execute(
        select(KnowledgeIngestionJob)
        .where(
            KnowledgeIngestionJob.organization_id == body.organization_id,
            KnowledgeIngestionJob.knowledge_base_id == body.kb_id,
        )
        .order_by(KnowledgeIngestionJob.created_at.desc())
    )
    jobs = result.scalars().all()
    return {"items": [serialize_job(job) for job in jobs]}


@router.post("/documents/list")
async def list_documents_route(
    body: DocumentsListRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    await _get_kb_or_404(db, body.organization_id, body.kb_id)

    query = select(KnowledgeDocument).where(KnowledgeDocument.knowledge_base_id == body.kb_id)
    if body.query:
        pattern = f"%{body.query.strip()}%"
        query = query.where(
            (KnowledgeDocument.title.ilike(pattern))
            | (KnowledgeDocument.canonical_url.ilike(pattern))
            | (KnowledgeDocument.content_markdown.ilike(pattern))
        )
    query = query.order_by(KnowledgeDocument.updated_at.desc()).limit(body.limit)

    result = await db.execute(query)
    docs = result.scalars().all()
    return {"items": [_serialize_document(doc) for doc in docs]}


@router.post("/documents/delete")
async def delete_document_route(
    body: DocumentDeleteRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    await _get_kb_or_404(db, body.organization_id, body.kb_id)
    document = await db.get(KnowledgeDocument, body.document_id)
    if not document or document.knowledge_base_id != body.kb_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    await db.delete(document)
    await db.commit()
    return {"status": "ok"}


@router.post("/search")
async def search_route(
    body: SearchRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    await _get_kb_or_404(db, body.organization_id, body.kb_id)
    hits = await search_chunks(
        db,
        organization_id=body.organization_id,
        kb_ids=[body.kb_id],
        query=body.query,
        limit=body.limit,
    )
    return {"items": hits}


@router.post("/search/multi-kb")
async def search_multi_route(
    body: MultiKBSearchRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    if not body.kb_ids:
        return {"items": []}
    # Validate all requested KB ids belong to organization.
    result = await db.execute(
        select(KnowledgeBase.id).where(
            KnowledgeBase.organization_id == body.organization_id,
            KnowledgeBase.id.in_(body.kb_ids),
        )
    )
    valid_ids = set(result.scalars().all())
    kb_ids = [kb_id for kb_id in body.kb_ids if kb_id in valid_ids]
    if not kb_ids:
        return {"items": []}
    hits = await search_chunks(
        db,
        organization_id=body.organization_id,
        kb_ids=kb_ids,
        query=body.query,
        limit=body.limit,
    )
    return {"items": hits}


@router.post("/embedding-config/get")
async def embedding_config_get(
    body: OrganizationScopedRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    config = await db.get(OrganizationEmbeddingConfig, body.organization_id)
    if not config:
        return {"item": None}
    return {
        "item": {
            "organization_id": str(config.organization_id),
            "provider": config.provider,
            "model": config.model,
            "updated_at": config.updated_at.isoformat(),
        }
    }


@router.post("/embedding-config/put")
async def embedding_config_put(
    body: EmbeddingConfigPutRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    config = await db.get(OrganizationEmbeddingConfig, body.organization_id)
    if config is None:
        config = OrganizationEmbeddingConfig(
            organization_id=body.organization_id,
            provider=body.provider.strip(),
            model=body.model.strip(),
            api_key_encrypted=encrypt_secret(body.api_key),
        )
        db.add(config)
    else:
        config.provider = body.provider.strip()
        config.model = body.model.strip()
        config.api_key_encrypted = encrypt_secret(body.api_key)
    await db.commit()
    await db.refresh(config)
    return {
        "item": {
            "organization_id": str(config.organization_id),
            "provider": config.provider,
            "model": config.model,
            "updated_at": config.updated_at.isoformat(),
        }
    }


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

