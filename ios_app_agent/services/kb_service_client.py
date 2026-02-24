import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from jose import jwt

from ios_app_agent.config import settings


@dataclass
class KBServiceError(Exception):
    status_code: int
    detail: str
    code: str | None = None

    def __str__(self) -> str:
        return self.detail


def _build_service_token(org_id: uuid.UUID, actor_id: str, actor_role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "iss": "core-api",
        "aud": settings.kb_service_audience,
        "sub": "core-api",
        "org_id": str(org_id),
        "actor_id": actor_id,
        "actor_role": actor_role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=2)).timestamp()),
    }
    return jwt.encode(payload, settings.kb_service_signing_key, algorithm=settings.kb_service_jwt_algorithm)


def _extract_error(response: httpx.Response) -> tuple[str, str | None]:
    try:
        body = response.json()
    except ValueError:
        return response.text or response.reason_phrase, None

    if not isinstance(body, dict):
        return "Knowledge base service request failed", None

    code: str | None = None
    if isinstance(body.get("code"), str):
        code = body["code"]

    detail_payload = body.get("detail")
    if isinstance(detail_payload, dict):
        if isinstance(detail_payload.get("code"), str):
            code = detail_payload["code"]
        if isinstance(detail_payload.get("detail"), str) and detail_payload["detail"].strip():
            return detail_payload["detail"], code

    if isinstance(detail_payload, str) and detail_payload.strip():
        return detail_payload, code

    return "Knowledge base service request failed", code


async def _call_internal(
    path: str,
    payload: dict[str, Any],
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
) -> dict[str, Any]:
    token = _build_service_token(org_id=org_id, actor_id=actor_id, actor_role=actor_role)
    timeout = httpx.Timeout(
        timeout=settings.kb_service_timeout_seconds,
        connect=settings.kb_service_connect_timeout_seconds,
    )
    url = f"{settings.kb_service_base_url.rstrip('/')}{path}"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as exc:
        raise KBServiceError(status_code=503, detail="Knowledge base service unavailable") from exc

    if not response.is_success:
        detail, code = _extract_error(response)
        raise KBServiceError(status_code=response.status_code, detail=detail, code=code)

    data = response.json()
    if not isinstance(data, dict):
        raise KBServiceError(status_code=502, detail="Knowledge base service returned invalid response")
    return data


async def list_knowledge_bases(*, org_id: uuid.UUID, actor_id: str, actor_role: str) -> dict[str, Any]:
    return await _call_internal(
        "/internal/kbs/list",
        {"organization_id": str(org_id)},
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def create_knowledge_base(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    name: str,
    description: str | None,
    embedding_profile_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/kbs/create",
        {
            "organization_id": str(org_id),
            "name": name,
            "description": description,
            "embedding_profile_id": str(embedding_profile_id),
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def get_knowledge_base(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/kbs/get",
        {"organization_id": str(org_id), "kb_id": str(kb_id)},
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def update_knowledge_base(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
    name: str | None,
    description: str | None,
    embedding_profile_id: uuid.UUID | None,
    confirm_regeneration: bool,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/kbs/update",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "name": name,
            "description": description,
            "embedding_profile_id": str(embedding_profile_id) if embedding_profile_id else None,
            "confirm_regeneration": confirm_regeneration,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def kb_embedding_change_impact(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
    embedding_profile_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/kbs/embedding-change-impact",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "embedding_profile_id": str(embedding_profile_id),
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def delete_knowledge_base(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/kbs/delete",
        {"organization_id": str(org_id), "kb_id": str(kb_id)},
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def list_sources(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/sources/list",
        {"organization_id": str(org_id), "kb_id": str(kb_id)},
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def add_url_source(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
    url: str,
    title: str | None,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/sources/add-url",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "url": url,
            "title": title,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def add_upload_source(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
    title: str,
    content: str,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/sources/add-upload",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "title": title,
            "content": content,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def recrawl_source(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
    source_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/sources/recrawl",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "source_id": str(source_id),
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def delete_source(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
    source_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/sources/delete",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "source_id": str(source_id),
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def list_jobs(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/jobs/list",
        {"organization_id": str(org_id), "kb_id": str(kb_id)},
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def list_documents(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
    query: str | None,
    limit: int,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/documents/list",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "query": query,
            "limit": limit,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def delete_document(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
    document_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/documents/delete",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "document_id": str(document_id),
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def search_knowledge_base(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_id: uuid.UUID,
    query: str,
    limit: int,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/search",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "query": query,
            "limit": limit,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def search_multiple_knowledge_bases(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    kb_ids: list[uuid.UUID],
    query: str,
    limit: int,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/search/multi-kb",
        {
            "organization_id": str(org_id),
            "kb_ids": [str(kb_id) for kb_id in kb_ids],
            "query": query,
            "limit": limit,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def list_embedding_profiles(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/embedding-profiles/list",
        {"organization_id": str(org_id)},
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def create_embedding_profile(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    name: str,
    provider: str,
    model: str,
    api_key: str,
    api_base: str | None,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/embedding-profiles/create",
        {
            "organization_id": str(org_id),
            "name": name,
            "provider": provider,
            "model": model,
            "api_key": api_key,
            "api_base": api_base,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def update_embedding_profile(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    profile_id: uuid.UUID,
    name: str | None,
    provider: str | None,
    model: str | None,
    api_key: str | None,
    api_base: str | None,
    confirm_regeneration: bool,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/embedding-profiles/update",
        {
            "organization_id": str(org_id),
            "profile_id": str(profile_id),
            "name": name,
            "provider": provider,
            "model": model,
            "api_key": api_key,
            "api_base": api_base,
            "confirm_regeneration": confirm_regeneration,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def delete_embedding_profile(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    profile_id: uuid.UUID,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/embedding-profiles/delete",
        {
            "organization_id": str(org_id),
            "profile_id": str(profile_id),
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def embedding_profile_change_impact(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    profile_id: uuid.UUID,
    provider: str | None,
    model: str | None,
    api_base: str | None,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/embedding-profiles/change-impact",
        {
            "organization_id": str(org_id),
            "profile_id": str(profile_id),
            "provider": provider,
            "model": model,
            "api_base": api_base,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )
