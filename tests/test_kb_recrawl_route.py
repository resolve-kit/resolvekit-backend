import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from kb_service.models import KnowledgeSource
from kb_service.router import recrawl
from kb_service.schemas import SourceMutateRequest


@pytest.mark.asyncio
async def test_recrawl_rejects_upload_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    org_id = uuid.uuid4()
    kb_id = uuid.uuid4()
    source_id = uuid.uuid4()

    principal = type("Principal", (), {"organization_id": org_id, "actor_id": "dev", "actor_role": "owner"})()

    source = KnowledgeSource(
        knowledge_base_id=kb_id,
        source_type="upload",
        title="Manual",
        upload_content="hello",
        status="ready",
    )
    source.id = source_id

    async def _fake_get_kb_or_404(db, organization_id, kb_id):  # noqa: ANN001
        return None

    monkeypatch.setattr("kb_service.router._get_kb_or_404", _fake_get_kb_or_404)

    db = AsyncMock()
    db.get = AsyncMock(return_value=source)

    with pytest.raises(HTTPException) as exc_info:
        await recrawl(
            body=SourceMutateRequest(
                organization_id=org_id,
                kb_id=kb_id,
                source_id=source_id,
            ),
            principal=principal,
            db=db,
        )

    assert exc_info.value.status_code == 400
    assert "url" in str(exc_info.value.detail).lower()
