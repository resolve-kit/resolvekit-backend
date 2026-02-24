import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer, require_app_ownership
from ios_app_agent.models.app import App
from ios_app_agent.models.app_knowledge_base import AppKnowledgeBase
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.knowledge_base_ref import KnowledgeBaseRef
from ios_app_agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
from ios_app_agent.schemas.knowledge_base import (
    AppKnowledgeBaseAssignmentsUpdate,
    KnowledgeBaseCreate,
    KnowledgeBaseEmbeddingChangeImpactRequest,
    KnowledgeBaseUpdate,
    KnowledgeSearchRequest,
    KnowledgeSourceUploadCreate,
    KnowledgeSourceURLCreate,
    OrganizationEmbeddingProfileChangeImpactRequest,
    OrganizationEmbeddingProfileCreate,
    OrganizationEmbeddingProfileUpdate,
)
from ios_app_agent.services.authorization_service import ORG_ADMIN_ROLES, require_org_role
from ios_app_agent.services.encryption import decrypt
from ios_app_agent.services.kb_service_client import (
    KBServiceError,
    add_upload_source,
    add_url_source,
    create_embedding_profile,
    create_knowledge_base,
    delete_document,
    delete_embedding_profile,
    delete_knowledge_base,
    delete_source,
    embedding_profile_change_impact,
    get_knowledge_base,
    kb_embedding_change_impact,
    list_documents,
    list_embedding_profiles,
    list_jobs,
    list_knowledge_bases,
    list_sources,
    recrawl_source,
    search_knowledge_base,
    update_embedding_profile,
    update_knowledge_base,
)

router = APIRouter(tags=["knowledge-bases"])


def _require_org_membership(developer: DeveloperAccount) -> uuid.UUID:
    if developer.organization_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return developer.organization_id


def _raise_kb_error(exc: KBServiceError) -> None:
    if exc.code:
        raise HTTPException(status_code=exc.status_code, detail={"code": exc.code, "detail": exc.detail})
    raise HTTPException(status_code=exc.status_code, detail=exc.detail)


async def _get_org_llm_profile_or_404(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    llm_profile_id: uuid.UUID,
) -> OrganizationLLMProviderProfile:
    profile = await db.get(OrganizationLLMProviderProfile, llm_profile_id)
    if profile is None or profile.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM profile not found")
    return profile


async def _upsert_kb_ref(db: AsyncSession, organization_id: uuid.UUID, kb_payload: dict[str, Any]) -> KnowledgeBaseRef:
    kb_id_raw = kb_payload.get("id")
    name = kb_payload.get("name") or "Knowledge Base"
    if not isinstance(kb_id_raw, str):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid KB service response")
    try:
        kb_external_id = uuid.UUID(kb_id_raw)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid KB service response") from exc

    result = await db.execute(
        select(KnowledgeBaseRef).where(
            KnowledgeBaseRef.organization_id == organization_id,
            KnowledgeBaseRef.external_kb_id == str(kb_external_id),
        )
    )
    ref = result.scalar_one_or_none()
    if ref is None:
        ref = KnowledgeBaseRef(
            organization_id=organization_id,
            external_kb_id=str(kb_external_id),
            name_cache=name,
        )
        db.add(ref)
    else:
        ref.name_cache = name
    await db.flush()
    return ref


async def _sync_refs_from_kb_list(db: AsyncSession, organization_id: uuid.UUID, kb_items: list[dict[str, Any]]) -> None:
    for item in kb_items:
        await _upsert_kb_ref(db, organization_id, item)


@router.get("/v1/knowledge-bases")
async def kb_list(
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    org_id = _require_org_membership(developer)
    try:
        payload = await list_knowledge_bases(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)

    items = payload.get("items", [])
    if not isinstance(items, list):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid KB service response")
    await _sync_refs_from_kb_list(db, org_id, [i for i in items if isinstance(i, dict)])
    await db.commit()
    return payload


@router.post("/v1/knowledge-bases", status_code=status.HTTP_201_CREATED)
async def kb_create(
    body: KnowledgeBaseCreate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        payload = await create_knowledge_base(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            name=body.name,
            description=body.description,
            embedding_profile_id=body.embedding_profile_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)

    kb = payload.get("item")
    if not isinstance(kb, dict):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid KB service response")
    await _upsert_kb_ref(db, org_id, kb)
    await db.commit()
    return payload


@router.get("/v1/knowledge-bases/{kb_id}")
async def kb_get(
    kb_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    try:
        return await get_knowledge_base(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.patch("/v1/knowledge-bases/{kb_id}")
async def kb_update(
    kb_id: uuid.UUID,
    body: KnowledgeBaseUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        payload = await update_knowledge_base(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
            name=body.name,
            description=body.description,
            embedding_profile_id=body.embedding_profile_id,
            confirm_regeneration=body.confirm_regeneration,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)

    kb = payload.get("item")
    if isinstance(kb, dict):
        await _upsert_kb_ref(db, org_id, kb)
        await db.commit()
    return payload


@router.post("/v1/knowledge-bases/{kb_id}/embedding-change-impact")
async def kb_update_embedding_change_impact(
    kb_id: uuid.UUID,
    body: KnowledgeBaseEmbeddingChangeImpactRequest,
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        return await kb_embedding_change_impact(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
            embedding_profile_id=body.embedding_profile_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.delete("/v1/knowledge-bases/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def kb_delete(
    kb_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
) -> Response:
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        await delete_knowledge_base(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)

    await db.execute(
        delete(KnowledgeBaseRef).where(
            KnowledgeBaseRef.organization_id == org_id,
            KnowledgeBaseRef.external_kb_id == str(kb_id),
        )
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/v1/knowledge-bases/{kb_id}/sources")
async def kb_sources_list(
    kb_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    try:
        return await list_sources(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.post("/v1/knowledge-bases/{kb_id}/sources/url", status_code=status.HTTP_201_CREATED)
async def kb_sources_add_url(
    kb_id: uuid.UUID,
    body: KnowledgeSourceURLCreate,
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        return await add_url_source(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
            url=body.url,
            title=body.title,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.post("/v1/knowledge-bases/{kb_id}/sources/upload", status_code=status.HTTP_201_CREATED)
async def kb_sources_add_upload(
    kb_id: uuid.UUID,
    body: KnowledgeSourceUploadCreate,
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        return await add_upload_source(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
            title=body.title,
            content=body.content,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.post("/v1/knowledge-bases/{kb_id}/sources/{source_id}/recrawl")
async def kb_sources_recrawl(
    kb_id: uuid.UUID,
    source_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        return await recrawl_source(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
            source_id=source_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.delete("/v1/knowledge-bases/{kb_id}/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def kb_sources_delete(
    kb_id: uuid.UUID,
    source_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
) -> Response:
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        await delete_source(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
            source_id=source_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/v1/knowledge-bases/{kb_id}/jobs")
async def kb_jobs_list(
    kb_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    try:
        return await list_jobs(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.get("/v1/knowledge-bases/{kb_id}/documents")
async def kb_documents_list(
    kb_id: uuid.UUID,
    query: str | None = Query(default=None, max_length=255),
    limit: int = Query(default=50, ge=1, le=200),
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    try:
        return await list_documents(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
            query=query,
            limit=limit,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.delete("/v1/knowledge-bases/{kb_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def kb_documents_delete(
    kb_id: uuid.UUID,
    document_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
) -> Response:
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        await delete_document(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
            document_id=document_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/v1/knowledge-bases/{kb_id}/search")
async def kb_search(
    kb_id: uuid.UUID,
    body: KnowledgeSearchRequest,
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    try:
        return await search_knowledge_base(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            kb_id=kb_id,
            query=body.query,
            limit=body.limit,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.get("/v1/apps/{app_id}/knowledge-bases")
async def app_kb_assignments_get(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    result = await db.execute(
        select(KnowledgeBaseRef)
        .join(AppKnowledgeBase, AppKnowledgeBase.knowledge_base_ref_id == KnowledgeBaseRef.id)
        .where(AppKnowledgeBase.app_id == app_id)
        .order_by(KnowledgeBaseRef.name_cache.asc())
    )
    refs = result.scalars().all()
    return {
        "items": [
            {
                "id": ref.external_kb_id,
                "name": ref.name_cache,
            }
            for ref in refs
        ]
    }


@router.put("/v1/apps/{app_id}/knowledge-bases")
async def app_kb_assignments_put(
    app_id: uuid.UUID,
    body: AppKnowledgeBaseAssignmentsUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)
    require_org_role(developer, ORG_ADMIN_ROLES)

    org_id = _require_org_membership(developer)

    refs: list[KnowledgeBaseRef] = []
    unique_kb_ids = list(dict.fromkeys(body.knowledge_base_ids))
    for kb_id in unique_kb_ids:
        result = await db.execute(
            select(KnowledgeBaseRef).where(
                KnowledgeBaseRef.organization_id == org_id,
                KnowledgeBaseRef.external_kb_id == str(kb_id),
            )
        )
        ref = result.scalar_one_or_none()
        if ref is None:
            try:
                kb_payload = await get_knowledge_base(
                    org_id=org_id,
                    actor_id=str(developer.id),
                    actor_role=developer.role,
                    kb_id=kb_id,
                )
            except KBServiceError as exc:
                _raise_kb_error(exc)
            item = kb_payload.get("item")
            if not isinstance(item, dict):
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid KB service response")
            ref = await _upsert_kb_ref(db, org_id, item)
        refs.append(ref)

    await db.execute(delete(AppKnowledgeBase).where(AppKnowledgeBase.app_id == app_id))
    for ref in refs:
        db.add(
            AppKnowledgeBase(
                app_id=app_id,
                knowledge_base_ref_id=ref.id,
            )
        )
    await db.commit()

    return {
        "items": [
            {
                "id": ref.external_kb_id,
                "name": ref.name_cache,
            }
            for ref in refs
        ]
    }


@router.get("/v1/organizations/embedding-profiles")
async def organization_embedding_profiles_list(
    developer: DeveloperAccount = Depends(get_current_developer),
):
    org_id = _require_org_membership(developer)
    try:
        return await list_embedding_profiles(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.post("/v1/organizations/embedding-profiles", status_code=status.HTTP_201_CREATED)
async def organization_embedding_profiles_create(
    body: OrganizationEmbeddingProfileCreate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    llm_profile = await _get_org_llm_profile_or_404(
        db,
        organization_id=org_id,
        llm_profile_id=body.llm_profile_id,
    )
    try:
        return await create_embedding_profile(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            name=body.name,
            llm_profile_id=llm_profile.id,
            llm_profile_name=llm_profile.name,
            provider=llm_profile.provider,
            embedding_model=body.embedding_model,
            api_key=decrypt(llm_profile.api_key_encrypted),
            api_base=llm_profile.api_base,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.patch("/v1/organizations/embedding-profiles/{profile_id}")
async def organization_embedding_profiles_update(
    profile_id: uuid.UUID,
    body: OrganizationEmbeddingProfileUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)

    llm_profile: OrganizationLLMProviderProfile | None = None
    if body.llm_profile_id is not None:
        llm_profile = await _get_org_llm_profile_or_404(
            db,
            organization_id=org_id,
            llm_profile_id=body.llm_profile_id,
        )

    try:
        return await update_embedding_profile(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            profile_id=profile_id,
            name=body.name,
            llm_profile_id=llm_profile.id if llm_profile else None,
            llm_profile_name=llm_profile.name if llm_profile else None,
            provider=llm_profile.provider if llm_profile else None,
            embedding_model=body.embedding_model,
            api_key=decrypt(llm_profile.api_key_encrypted) if llm_profile else None,
            api_base=llm_profile.api_base if llm_profile else None,
            confirm_regeneration=body.confirm_regeneration,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.post("/v1/organizations/embedding-profiles/{profile_id}/change-impact")
async def organization_embedding_profiles_change_impact(
    profile_id: uuid.UUID,
    body: OrganizationEmbeddingProfileChangeImpactRequest,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)

    llm_profile: OrganizationLLMProviderProfile | None = None
    if body.llm_profile_id is not None:
        llm_profile = await _get_org_llm_profile_or_404(
            db,
            organization_id=org_id,
            llm_profile_id=body.llm_profile_id,
        )

    try:
        return await embedding_profile_change_impact(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            profile_id=profile_id,
            llm_profile_id=llm_profile.id if llm_profile else None,
            provider=llm_profile.provider if llm_profile else None,
            embedding_model=body.embedding_model,
            api_base=llm_profile.api_base if llm_profile else None,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)


@router.delete("/v1/organizations/embedding-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def organization_embedding_profiles_delete(
    profile_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
) -> Response:
    org_id = _require_org_membership(developer)
    require_org_role(developer, ORG_ADMIN_ROLES)
    try:
        await delete_embedding_profile(
            org_id=org_id,
            actor_id=str(developer.id),
            actor_role=developer.role,
            profile_id=profile_id,
        )
    except KBServiceError as exc:
        _raise_kb_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
