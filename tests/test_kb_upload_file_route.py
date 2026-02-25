import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, UploadFile

from kb_service.models import KnowledgeBase
from kb_service.router import add_upload_file


@pytest.mark.asyncio
async def test_add_upload_file_creates_source_and_job(monkeypatch: pytest.MonkeyPatch) -> None:
    org_id = uuid.uuid4()
    kb_id = uuid.uuid4()
    principal = type("Principal", (), {"organization_id": org_id, "actor_id": "dev", "actor_role": "owner"})()

    kb = KnowledgeBase(organization_id=org_id, name="Docs", description=None)
    kb.id = kb_id

    class _DB:
        def __init__(self):
            self.added = []
            self.flush = AsyncMock()
            self.commit = AsyncMock()
            self.refresh = AsyncMock()

        def add(self, obj):  # noqa: ANN001
            self.added.append(obj)

    db = _DB()

    async def _fake_get_kb_or_404(_db, organization_id, kb_id):  # noqa: ANN001
        assert organization_id == org_id
        assert kb_id == kb.id
        return kb

    class _Job:
        id = uuid.uuid4()
        organization_id = org_id
        knowledge_base_id = kb_id
        source_id = uuid.uuid4()
        target_embedding_profile_id = None
        job_type = "ingest_source"
        status = "pending"
        error = None
        stats_json = {}

    async def _fake_enqueue(*args, **kwargs):  # noqa: ANN001
        return _Job()

    def _fake_serialize(job):  # noqa: ANN001
        return {"id": str(job.id), "status": job.status}

    def _fake_serialize_source(source):  # noqa: ANN001
        return {
            "id": str(source.id),
            "knowledge_base_id": str(source.knowledge_base_id),
            "source_type": source.source_type,
            "input_url": source.input_url,
            "title": source.title,
            "status": source.status,
            "last_crawled_at": None,
            "last_error": source.last_error,
            "created_at": "",
            "updated_at": "",
        }

    def _fake_convert(**kwargs):  # noqa: ANN001
        return type("Converted", (), {"title": "FAQ", "markdown": "hello world"})()

    monkeypatch.setattr("kb_service.router._get_kb_or_404", _fake_get_kb_or_404)
    monkeypatch.setattr("kb_service.router.enqueue_ingestion_job", _fake_enqueue)
    monkeypatch.setattr("kb_service.router.serialize_job", _fake_serialize)
    monkeypatch.setattr("kb_service.router._serialize_source", _fake_serialize_source)
    monkeypatch.setattr("kb_service.router.convert_uploaded_file_bytes", _fake_convert)

    upload = UploadFile(filename="faq.txt", file=AsyncMock())
    upload.read = AsyncMock(return_value=b"hello world")

    payload = await add_upload_file(
        organization_id=org_id,
        kb_id=kb_id,
        file=upload,
        title=None,
        principal=principal,
        db=db,
    )

    assert payload["source"]["source_type"] == "upload"
    assert payload["job"]["status"] == "pending"
    assert db.commit.await_count == 1


@pytest.mark.asyncio
async def test_add_upload_file_rejects_org_scope_mismatch() -> None:
    org_id = uuid.uuid4()
    principal = type("Principal", (), {"organization_id": uuid.uuid4(), "actor_id": "dev", "actor_role": "owner"})()

    with pytest.raises(HTTPException) as exc_info:
        await add_upload_file(
            organization_id=org_id,
            kb_id=uuid.uuid4(),
            file=UploadFile(filename="faq.txt", file=AsyncMock()),
            title=None,
            principal=principal,
            db=AsyncMock(),
        )

    assert exc_info.value.status_code == 403
