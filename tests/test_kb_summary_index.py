import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from knowledge_bases.models import KnowledgeBase, KnowledgeDocument, KnowledgeSource
from knowledge_bases.router import _serialize_kb, delete_source
from knowledge_bases.schemas import KBCreateRequest, SourceMutateRequest
from knowledge_bases.services.summary_index import _build_docs_blob, _resolve_model_name, refresh_kb_summary_index


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


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DummySummaryDB:
    def __init__(self, docs):
        self._docs = docs

    async def execute(self, _statement):  # noqa: ANN001
        return _ScalarResult(self._docs)


def _build_summary_test_kb() -> KnowledgeBase:
    kb = KnowledgeBase(
        organization_id=uuid.uuid4(),
        name="Support KB",
        description="support docs",
        summary_llm_profile_id=uuid.uuid4(),
        summary_llm_profile_name="OpenAI",
        summary_provider="openai",
        summary_model="gpt-5",
        summary_api_key_encrypted="encrypted",
        summary_api_base=None,
    )
    kb.id = uuid.uuid4()
    return kb


def _build_summary_test_doc(kb_id: uuid.UUID) -> KnowledgeDocument:
    return KnowledgeDocument(
        knowledge_base_id=kb_id,
        source_id=uuid.uuid4(),
        canonical_url="https://docs.example.com/reset-password",
        title="Reset Password",
        content_markdown="Step 1 open settings. Step 2 tap account.",
        content_hash="hash-1",
        metadata_json={},
    )


def test_build_docs_blob_uses_fixed_length_fingerprint_hash() -> None:
    kb_id = uuid.uuid4()
    docs = [
        KnowledgeDocument(
            knowledge_base_id=kb_id,
            source_id=uuid.uuid4(),
            canonical_url="https://docs.example.com/reset-password",
            title="Reset Password",
            content_markdown="Step 1 open settings. Step 2 tap account.",
            content_hash=f"hash-{idx}",
            metadata_json={},
        )
        for idx in range(20)
    ]

    blob, fingerprint = _build_docs_blob(docs)

    assert blob
    assert len(fingerprint) == 64
    assert all(char in "0123456789abcdef" for char in fingerprint)


def test_resolve_model_name_normalizes_google_provider_for_litellm() -> None:
    assert _resolve_model_name("google", "gemini-2.5-flash-lite") == "gemini/gemini-2.5-flash-lite"


def test_resolve_model_name_normalizes_legacy_google_model_alias() -> None:
    assert _resolve_model_name("google", "gemini-flash-lite-latest") == "gemini/gemini-2.0-flash-lite"


@pytest.mark.asyncio
async def test_refresh_kb_summary_index_retries_without_temperature(monkeypatch: pytest.MonkeyPatch) -> None:
    class UnsupportedParamsError(Exception):
        pass

    kb = _build_summary_test_kb()
    doc = _build_summary_test_doc(kb.id)

    db = _DummySummaryDB([doc])

    completion_mock = AsyncMock(
        side_effect=[
            UnsupportedParamsError("gpt-5 models don't support temperature=0"),
            {
                "choices": [
                    {
                        "message": {
                            "content": '{"summary":"Covers password reset flows.","topics":["password reset","settings"]}'
                        }
                    }
                ]
            },
        ]
    )
    monkeypatch.setattr("knowledge_bases.services.summary_index.decrypt_secret", lambda _value: "test-key")
    monkeypatch.setattr("knowledge_bases.services.llm_compat.litellm.acompletion", completion_mock)

    await refresh_kb_summary_index(db, kb=kb)

    assert kb.summary_status == "ready"
    assert kb.summary_text == "Covers password reset flows."
    assert kb.summary_topics_json == ["password reset", "settings"]
    assert completion_mock.await_count == 2
    assert completion_mock.await_args_list[0].kwargs.get("temperature") == 0
    assert "temperature" not in completion_mock.await_args_list[1].kwargs


@pytest.mark.asyncio
async def test_refresh_kb_summary_index_accepts_plain_text_summary(monkeypatch: pytest.MonkeyPatch) -> None:
    kb = _build_summary_test_kb()
    doc = _build_summary_test_doc(kb.id)
    db = _DummySummaryDB([doc])

    completion_mock = AsyncMock(
        return_value={
            "choices": [
                {
                    "message": {
                        "content": "This knowledge base covers password reset and account settings troubleshooting."
                    }
                }
            ]
        }
    )
    monkeypatch.setattr("knowledge_bases.services.summary_index.decrypt_secret", lambda _value: "test-key")
    monkeypatch.setattr("knowledge_bases.services.llm_compat.litellm.acompletion", completion_mock)

    await refresh_kb_summary_index(db, kb=kb)

    assert kb.summary_status == "ready"
    assert kb.summary_text == "This knowledge base covers password reset and account settings troubleshooting."
    assert kb.summary_topics_json == []
    assert kb.summary_last_error is None


@pytest.mark.asyncio
async def test_refresh_kb_summary_index_uses_doc_fallback_when_response_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    kb = _build_summary_test_kb()
    doc = _build_summary_test_doc(kb.id)
    db = _DummySummaryDB([doc])

    completion_mock = AsyncMock(return_value={"choices": [{"message": {"content": ""}}]})
    monkeypatch.setattr("knowledge_bases.services.summary_index.decrypt_secret", lambda _value: "test-key")
    monkeypatch.setattr("knowledge_bases.services.llm_compat.litellm.acompletion", completion_mock)

    await refresh_kb_summary_index(db, kb=kb)

    assert kb.summary_status == "ready"
    assert "Reset Password" in (kb.summary_text or "")
    assert kb.summary_topics_json == []
    assert kb.summary_last_error is None
