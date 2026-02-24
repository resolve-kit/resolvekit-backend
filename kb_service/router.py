import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from kb_service.auth import ServicePrincipal, get_service_principal
from kb_service.database import get_db
from kb_service.models import (
    KnowledgeBase,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeIngestionJob,
    KnowledgeSource,
    OrganizationEmbeddingProfile,
)
from kb_service.schemas import (
    DocumentDeleteRequest,
    DocumentsListRequest,
    EmbeddingProfileChangeImpactRequest,
    EmbeddingProfileCreateRequest,
    EmbeddingProfileGetRequest,
    EmbeddingProfileUpdateRequest,
    KBCreateRequest,
    KBEmbeddingChangeImpactRequest,
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

_CONFIRMATION_CODE = "EMBEDDING_REGEN_CONFIRMATION_REQUIRED"
_REGEN_BUSY_STATUSES = {"pending", "processing"}


def _ensure_org_scope(principal: ServicePrincipal, organization_id: uuid.UUID) -> None:
    if principal.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization scope mismatch")


def _serialize_profile(profile: OrganizationEmbeddingProfile) -> dict[str, Any]:
    return {
        "id": str(profile.id),
        "organization_id": str(profile.organization_id),
        "name": profile.name,
        "llm_profile_id": str(profile.llm_profile_id),
        "llm_profile_name": profile.llm_profile_name,
        "provider": profile.provider,
        "embedding_model": profile.model,
        "api_base": profile.api_base,
        "updated_at": profile.updated_at.isoformat(),
        "created_at": profile.created_at.isoformat(),
    }


def _serialize_kb(kb: KnowledgeBase, profile_name: str | None = None) -> dict[str, Any]:
    return {
        "id": str(kb.id),
        "organization_id": str(kb.organization_id),
        "name": kb.name,
        "description": kb.description,
        "embedding_profile_id": str(kb.embedding_profile_id) if kb.embedding_profile_id else None,
        "embedding_profile_name": profile_name,
        "pending_embedding_profile_id": (
            str(kb.pending_embedding_profile_id) if kb.pending_embedding_profile_id else None
        ),
        "embedding_regeneration_status": kb.embedding_regeneration_status,
        "embedding_regeneration_error": kb.embedding_regeneration_error,
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


def _confirmation_detail(message: str) -> dict[str, str]:
    return {
        "code": _CONFIRMATION_CODE,
        "detail": message,
    }


async def _get_profile_or_404(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> OrganizationEmbeddingProfile:
    profile = await db.get(OrganizationEmbeddingProfile, profile_id)
    if profile is None or profile.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Embedding profile not found")
    return profile


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


def _apply_active_profile_to_kb(kb: KnowledgeBase, profile: OrganizationEmbeddingProfile) -> None:
    kb.embedding_profile_id = profile.id
    kb.embedding_provider = profile.provider
    kb.embedding_model = profile.model
    kb.embedding_api_key_encrypted = profile.api_key_encrypted
    kb.embedding_api_base = profile.api_base


def _apply_pending_profile_to_kb(kb: KnowledgeBase, profile: OrganizationEmbeddingProfile) -> None:
    kb.pending_embedding_profile_id = profile.id
    kb.pending_embedding_provider = profile.provider
    kb.pending_embedding_model = profile.model
    kb.pending_embedding_api_key_encrypted = profile.api_key_encrypted
    kb.pending_embedding_api_base = profile.api_base
    kb.embedding_regeneration_status = "pending"
    kb.embedding_regeneration_error = None


async def _kb_counts(db: AsyncSession, kb_ids: list[uuid.UUID]) -> tuple[int, int, int]:
    if not kb_ids:
        return 0, 0, 0

    docs_count_result = await db.execute(
        select(func.count())
        .select_from(KnowledgeDocument)
        .where(KnowledgeDocument.knowledge_base_id.in_(kb_ids))
    )
    chunks_count_result = await db.execute(
        select(func.count())
        .select_from(KnowledgeChunk)
        .where(KnowledgeChunk.knowledge_base_id.in_(kb_ids))
    )
    token_result = await db.execute(
        select(func.coalesce(func.sum(KnowledgeChunk.token_count), 0)).where(
            KnowledgeChunk.knowledge_base_id.in_(kb_ids)
        )
    )

    return (
        int(docs_count_result.scalar_one() or 0),
        int(chunks_count_result.scalar_one() or 0),
        int(token_result.scalar_one() or 0),
    )


async def _kb_chunk_count(db: AsyncSession, kb_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(KnowledgeChunk)
        .where(KnowledgeChunk.knowledge_base_id == kb_id)
    )
    return int(result.scalar_one() or 0)


async def _kb_impact(db: AsyncSession, kb_id: uuid.UUID) -> dict[str, Any]:
    docs, chunks, estimated_tokens = await _kb_counts(db, [kb_id])
    return {
        "kb_count": 1,
        "doc_count": docs,
        "chunk_count": chunks,
        "estimated_tokens": estimated_tokens,
        "estimate_available": True,
    }


async def _profile_active_kb_ids(db: AsyncSession, organization_id: uuid.UUID, profile_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(KnowledgeBase.id).where(
            KnowledgeBase.organization_id == organization_id,
            KnowledgeBase.embedding_profile_id == profile_id,
        )
    )
    return list(result.scalars().all())


async def _profile_impact(db: AsyncSession, organization_id: uuid.UUID, profile_id: uuid.UUID) -> dict[str, Any]:
    kb_ids = await _profile_active_kb_ids(db, organization_id, profile_id)
    docs, chunks, estimated_tokens = await _kb_counts(db, kb_ids)
    return {
        "kb_count": len(kb_ids),
        "doc_count": docs,
        "chunk_count": chunks,
        "estimated_tokens": estimated_tokens,
        "estimate_available": True,
    }


def _profile_name_map(profiles: list[OrganizationEmbeddingProfile]) -> dict[uuid.UUID, str]:
    return {profile.id: profile.name for profile in profiles}


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
    kbs = result.scalars().all()
    profiles_result = await db.execute(
        select(OrganizationEmbeddingProfile).where(
            OrganizationEmbeddingProfile.organization_id == body.organization_id
        )
    )
    profile_names = _profile_name_map(profiles_result.scalars().all())
    return {
        "items": [
            _serialize_kb(kb, profile_name=profile_names.get(kb.embedding_profile_id))
            for kb in kbs
        ]
    }


@router.post("/kbs/create")
async def create_kb(
    body: KBCreateRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    profile = await _get_profile_or_404(
        db,
        organization_id=body.organization_id,
        profile_id=body.embedding_profile_id,
    )
    kb = KnowledgeBase(
        organization_id=body.organization_id,
        name=body.name.strip(),
        description=body.description,
    )
    _apply_active_profile_to_kb(kb, profile)
    db.add(kb)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Knowledge base name already exists")
    await db.refresh(kb)
    return {"item": _serialize_kb(kb, profile_name=profile.name)}


@router.post("/kbs/get")
async def get_kb(
    body: KBGetRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    kb = await _get_kb_or_404(db, body.organization_id, body.kb_id)
    profile_name = None
    if kb.embedding_profile_id:
        profile = await db.get(OrganizationEmbeddingProfile, kb.embedding_profile_id)
        if profile and profile.organization_id == body.organization_id:
            profile_name = profile.name
    return {"item": _serialize_kb(kb, profile_name=profile_name)}


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

    queued_job: dict[str, Any] | None = None
    if body.embedding_profile_id is not None and body.embedding_profile_id != kb.embedding_profile_id:
        if kb.embedding_regeneration_status in _REGEN_BUSY_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Embedding regeneration is already in progress for this knowledge base",
            )

        target_profile = await _get_profile_or_404(
            db,
            organization_id=body.organization_id,
            profile_id=body.embedding_profile_id,
        )
        impact = await _kb_impact(db, kb.id)
        if impact["chunk_count"] > 0:
            if not body.confirm_regeneration:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=_confirmation_detail(
                        "Changing embedding profile will regenerate vectors and may incur provider costs"
                    ),
                )
            _apply_pending_profile_to_kb(kb, target_profile)
            job = await enqueue_ingestion_job(
                db,
                organization_id=kb.organization_id,
                knowledge_base_id=kb.id,
                source_id=None,
                job_type="reembed_kb",
                target_embedding_profile_id=target_profile.id,
            )
            queued_job = serialize_job(job)
        else:
            _apply_active_profile_to_kb(kb, target_profile)

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Knowledge base name already exists")
    await db.refresh(kb)

    profile_name = None
    if kb.embedding_profile_id:
        profile = await db.get(OrganizationEmbeddingProfile, kb.embedding_profile_id)
        if profile and profile.organization_id == body.organization_id:
            profile_name = profile.name

    payload: dict[str, Any] = {"item": _serialize_kb(kb, profile_name=profile_name)}
    if queued_job is not None:
        payload["job"] = queued_job
    return payload


@router.post("/kbs/embedding-change-impact")
async def kb_embedding_change_impact(
    body: KBEmbeddingChangeImpactRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    kb = await _get_kb_or_404(db, body.organization_id, body.kb_id)
    await _get_profile_or_404(db, organization_id=body.organization_id, profile_id=body.embedding_profile_id)

    if kb.embedding_profile_id == body.embedding_profile_id:
        return {
            "kb_count": 1,
            "doc_count": 0,
            "chunk_count": 0,
            "estimated_tokens": 0,
            "estimate_available": True,
        }

    return await _kb_impact(db, kb.id)


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


@router.post("/embedding-profiles/list")
async def embedding_profiles_list(
    body: OrganizationScopedRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    result = await db.execute(
        select(OrganizationEmbeddingProfile)
        .where(OrganizationEmbeddingProfile.organization_id == body.organization_id)
        .order_by(OrganizationEmbeddingProfile.created_at.asc())
    )
    return {"items": [_serialize_profile(profile) for profile in result.scalars().all()]}


@router.post("/embedding-profiles/create")
async def embedding_profiles_create(
    body: EmbeddingProfileCreateRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    profile = OrganizationEmbeddingProfile(
        organization_id=body.organization_id,
        name=body.name.strip(),
        llm_profile_id=body.llm_profile_id,
        llm_profile_name=body.llm_profile_name.strip(),
        provider=body.provider.strip(),
        model=body.embedding_model.strip(),
        api_key_encrypted=encrypt_secret(body.api_key),
        api_base=body.api_base.strip() if body.api_base else None,
    )
    db.add(profile)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Embedding profile name already exists")
    await db.refresh(profile)
    return {"item": _serialize_profile(profile)}


@router.post("/embedding-profiles/change-impact")
async def embedding_profiles_change_impact(
    body: EmbeddingProfileChangeImpactRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    profile = await _get_profile_or_404(
        db,
        organization_id=body.organization_id,
        profile_id=body.profile_id,
    )
    updates = body.model_dump(exclude_unset=True)

    provider = body.provider.strip() if body.provider else profile.provider
    embedding_model = body.embedding_model.strip() if body.embedding_model else profile.model
    if "api_base" in updates:
        api_base = body.api_base.strip() if body.api_base else None
    else:
        api_base = profile.api_base

    behavior_changed = (
        provider != profile.provider
        or embedding_model != profile.model
        or api_base != profile.api_base
    )
    if not behavior_changed:
        return {
            "kb_count": 0,
            "doc_count": 0,
            "chunk_count": 0,
            "estimated_tokens": 0,
            "estimate_available": True,
        }

    return await _profile_impact(db, body.organization_id, profile.id)


@router.post("/embedding-profiles/update")
async def embedding_profiles_update(
    body: EmbeddingProfileUpdateRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    profile = await _get_profile_or_404(
        db,
        organization_id=body.organization_id,
        profile_id=body.profile_id,
    )

    updates = body.model_dump(exclude_unset=True)
    next_name = body.name.strip() if body.name is not None else profile.name
    next_llm_profile_id = body.llm_profile_id if body.llm_profile_id is not None else profile.llm_profile_id
    next_llm_profile_name = body.llm_profile_name.strip() if body.llm_profile_name is not None else profile.llm_profile_name
    next_provider = body.provider.strip() if body.provider is not None else profile.provider
    next_model = body.embedding_model.strip() if body.embedding_model is not None else profile.model
    if "api_base" in updates:
        next_api_base = body.api_base.strip() if body.api_base else None
    else:
        next_api_base = profile.api_base

    behavior_changed = (
        next_provider != profile.provider
        or next_model != profile.model
        or next_api_base != profile.api_base
    )

    if behavior_changed:
        impact = await _profile_impact(db, body.organization_id, profile.id)
        if impact["chunk_count"] > 0 and not body.confirm_regeneration:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_confirmation_detail(
                    "Changing embedding provider/model will regenerate vectors and may incur provider costs"
                ),
            )

    # Ensure no overlapping regeneration jobs for affected KBs.
    affected_kbs_result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.organization_id == body.organization_id,
            KnowledgeBase.embedding_profile_id == profile.id,
        )
    )
    affected_kbs = affected_kbs_result.scalars().all()
    if behavior_changed and any(kb.embedding_regeneration_status in _REGEN_BUSY_STATUSES for kb in affected_kbs):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more knowledge bases are already regenerating embeddings",
        )

    profile.name = next_name
    profile.llm_profile_id = next_llm_profile_id
    profile.llm_profile_name = next_llm_profile_name
    profile.provider = next_provider
    profile.model = next_model
    profile.api_base = next_api_base
    if body.api_key is not None:
        profile.api_key_encrypted = encrypt_secret(body.api_key)

    queued = 0
    if behavior_changed:
        for kb in affected_kbs:
            chunk_count = await _kb_chunk_count(db, kb.id)
            if chunk_count > 0:
                _apply_pending_profile_to_kb(kb, profile)
                await enqueue_ingestion_job(
                    db,
                    organization_id=kb.organization_id,
                    knowledge_base_id=kb.id,
                    source_id=None,
                    job_type="reembed_kb",
                    target_embedding_profile_id=profile.id,
                )
                queued += 1
            else:
                _apply_active_profile_to_kb(kb, profile)

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Embedding profile name already exists")
    await db.refresh(profile)

    return {
        "item": _serialize_profile(profile),
        "queued_regeneration_jobs": queued,
    }


@router.post("/embedding-profiles/delete")
async def embedding_profiles_delete(
    body: EmbeddingProfileGetRequest,
    principal: ServicePrincipal = Depends(get_service_principal),
    db: AsyncSession = Depends(get_db),
):
    _ensure_org_scope(principal, body.organization_id)
    profile = await _get_profile_or_404(
        db,
        organization_id=body.organization_id,
        profile_id=body.profile_id,
    )

    usage_result = await db.execute(
        select(KnowledgeBase.id).where(
            KnowledgeBase.organization_id == body.organization_id,
            (KnowledgeBase.embedding_profile_id == profile.id)
            | (KnowledgeBase.pending_embedding_profile_id == profile.id),
        )
    )
    if usage_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Embedding profile is used by one or more knowledge bases",
        )

    await db.delete(profile)
    await db.commit()
    return {"status": "ok"}


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
