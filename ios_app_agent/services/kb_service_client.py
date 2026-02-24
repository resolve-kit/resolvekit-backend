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
        try:
            body = response.json()
        except ValueError:
            body = {"detail": response.text or response.reason_phrase}
        detail = body.get("detail") if isinstance(body, dict) else None
        if not isinstance(detail, str) or not detail.strip():
            detail = "Knowledge base service request failed"
        raise KBServiceError(status_code=response.status_code, detail=detail)

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
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/kbs/create",
        {
            "organization_id": str(org_id),
            "name": name,
            "description": description,
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
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/kbs/update",
        {
            "organization_id": str(org_id),
            "kb_id": str(kb_id),
            "name": name,
            "description": description,
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


async def get_embedding_config(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/embedding-config/get",
        {"organization_id": str(org_id)},
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )


async def put_embedding_config(
    *,
    org_id: uuid.UUID,
    actor_id: str,
    actor_role: str,
    provider: str,
    model: str,
    api_key: str,
) -> dict[str, Any]:
    return await _call_internal(
        "/internal/embedding-config/put",
        {
            "organization_id": str(org_id),
            "provider": provider,
            "model": model,
            "api_key": api_key,
        },
        org_id=org_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )
