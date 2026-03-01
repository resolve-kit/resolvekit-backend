import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from knowledge_bases.models import KnowledgeBase, KnowledgeSource
from knowledge_bases.router import _serialize_kb, delete_source
from knowledge_bases.schemas import KBCreateRequest, SourceMutateRequest


def test_kb_create_request_requires_summary_model_configuration() -> None:
    with pytest.raises(ValidationError):
        KBCreateRequest(
            organization_id=uuid.uuid4(),
            name="Support Docs",
            description="help content",
            embedding_profile_id=uuid.uuid4(),
        )


def test_serialize_kb_includes_summary_index_fields() -> None:
    kb = KnowledgeBase(
        organization_id=uuid.uuid4(),
        name="Support Docs",
        description="help content",
    )
    kb.id = uuid.uuid4()
    kb.summary_text = "Covers login, billing, and account recovery."
    kb.summary_topics_json = ["login", "billing", "account recovery"]
    kb.summary_status = "ready"
    kb.summary_last_error = None
    kb.summary_updated_at = None
    kb.created_at = datetime.now(timezone.utc)
    kb.updated_at = datetime.now(timezone.utc)

    payload = _serialize_kb(kb)

    assert payload["summary_text"] == "Covers login, billing, and account recovery."
    assert payload["summary_topics"] == ["login", "billing", "account recovery"]
    assert payload["summary_status"] == "ready"


@pytest.mark.asyncio
async def test_delete_source_enqueues_kb_index_refresh(monkeypatch: pytest.MonkeyPatch) -> None:
    org_id = uuid.uuid4()
    kb_id = uuid.uuid4()
    source_id = uuid.uuid4()

    principal = type("Principal", (), {"organization_id": org_id, "actor_id": "dev", "actor_role": "owner"})()

    source = KnowledgeSource(
        knowledge_base_id=kb_id,
        source_type="url",
        input_url="https://docs.example.com/help",
        title="Help",
        status="ready",
    )
    source.id = source_id

    async def _fake_get_kb_or_404(db, organization_id, kb_id):  # noqa: ANN001
        assert db is not None
        assert organization_id == org_id
        assert kb_id == source.knowledge_base_id
        return None

    cleanup_mock = AsyncMock(return_value=0)
    enqueue_mock = AsyncMock()

    monkeypatch.setattr("knowledge_bases.router._get_kb_or_404", _fake_get_kb_or_404)
    monkeypatch.setattr("knowledge_bases.router.cleanup_image_assets_for_source", cleanup_mock)
    monkeypatch.setattr("knowledge_bases.router.enqueue_ingestion_job", enqueue_mock)

    db = AsyncMock()
    db.get = AsyncMock(return_value=source)

    payload = await delete_source(
        body=SourceMutateRequest(
            organization_id=org_id,
            kb_id=kb_id,
            source_id=source_id,
        ),
        principal=principal,
        db=db,
    )

    assert payload == {"status": "ok"}
    enqueue_mock.assert_awaited_once_with(
        db,
        organization_id=org_id,
        knowledge_base_id=kb_id,
        source_id=None,
        job_type="refresh_kb_index",
    )
