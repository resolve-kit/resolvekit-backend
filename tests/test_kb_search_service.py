import uuid
from types import SimpleNamespace

import pytest

from knowledge_bases.services import search as search_service


class _DummyScalarResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DummyDB:
    def __init__(self, kb_id: uuid.UUID):
        self._kb = SimpleNamespace(
            id=kb_id,
            embedding_provider=None,
            embedding_model=None,
            embedding_api_base=None,
            embedding_api_key_encrypted=None,
        )

    async def execute(self, _query):  # noqa: ANN001
        return _DummyScalarResult([self._kb])


@pytest.mark.asyncio
async def test_search_chunks_handles_empty_chunk_set_without_crashing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_embed_texts(texts, runtime):  # noqa: ANN001
        assert runtime is None
        assert texts == ["reset password"]
        return [[0.1, 0.2]]

    async def fake_load_chunks(db, kb_ids):  # noqa: ANN001
        assert db is not None
        assert len(kb_ids) == 1
        return []

    monkeypatch.setattr(search_service, "embed_texts", fake_embed_texts)
    monkeypatch.setattr(search_service, "_load_chunks_for_kbs", fake_load_chunks)
    kb_id = uuid.uuid4()

    result = await search_service.search_chunks(
        db=_DummyDB(kb_id),
        organization_id=uuid.uuid4(),
        kb_ids=[kb_id],
        query="reset password",
        limit=5,
    )

    assert result == []


def test_weighted_rrf_score_prefers_hybrid_match() -> None:
    # Hybrid candidate should outrank single-signal candidates.
    hybrid = search_service._weighted_rrf_score(semantic_rank=2, lexical_rank=2)
    semantic_only = search_service._weighted_rrf_score(semantic_rank=1, lexical_rank=None)
    lexical_only = search_service._weighted_rrf_score(semantic_rank=None, lexical_rank=1)

    assert hybrid > semantic_only
    assert hybrid > lexical_only


@pytest.mark.asyncio
async def test_load_postgres_lexical_ranks_fails_open_on_db_errors() -> None:
    class _FailingDB:
        async def execute(self, _query):  # noqa: ANN001
            raise RuntimeError("fts unavailable")

    rank_map, score_map = await search_service._load_postgres_lexical_ranks(
        db=_FailingDB(),
        kb_ids=[uuid.uuid4()],
        query="reset password",
        limit=10,
    )

    assert rank_map == {}
    assert score_map == {}


@pytest.mark.asyncio
async def test_search_chunks_includes_image_metadata_in_hits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    kb_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    source_id = uuid.uuid4()
    fake_chunk = SimpleNamespace(
        id=chunk_id,
        document_id=doc_id,
        knowledge_base_id=kb_id,
        content_text="Screenshot shows settings and account menu",
        embedding=[0.1, 0.2],
        metadata_json={
            "modality": "image_caption",
            "image_source_url": "https://images.ctfassets.net/tutorials/reset-step-1.png",
            "image_asset_path": "org/kb/hash.png",
            "section_heading": "Reset password",
        },
    )
    fake_doc = SimpleNamespace(
        id=doc_id,
        source_id=source_id,
        title="Reset password",
        canonical_url="https://docs.example.com/help/reset-password",
    )

    class _SearchDB:
        def __init__(self):
            self._kb = SimpleNamespace(
                id=kb_id,
                embedding_provider=None,
                embedding_model=None,
                embedding_api_base=None,
                embedding_api_key_encrypted=None,
            )

        async def execute(self, _query):  # noqa: ANN001
            query_text = str(_query)
            if "knowledge_documents" in query_text:
                return _DummyScalarResult([fake_doc])
            return _DummyScalarResult([self._kb])

    async def _fake_load_chunks(db, kb_ids):  # noqa: ANN001
        assert db is not None
        assert kb_ids == [kb_id]
        return [fake_chunk]

    async def _fake_embed_texts(texts, runtime):  # noqa: ANN001
        assert texts == ["reset password screenshot"]
        assert runtime is None
        return [[0.1, 0.2]]

    async def _fake_lexical_ranks(db, kb_ids, query, limit):  # noqa: ANN001
        assert db is not None
        assert kb_ids == [kb_id]
        assert query == "reset password screenshot"
        assert limit > 0
        return ({chunk_id: 1}, {chunk_id: 0.75})

    monkeypatch.setattr(search_service, "_load_chunks_for_kbs", _fake_load_chunks)
    monkeypatch.setattr(search_service, "embed_texts", _fake_embed_texts)
    monkeypatch.setattr(search_service, "_load_postgres_lexical_ranks", _fake_lexical_ranks)

    hits = await search_service.search_chunks(
        db=_SearchDB(),
        organization_id=uuid.uuid4(),
        kb_ids=[kb_id],
        query="reset password screenshot",
        limit=3,
    )

    assert len(hits) == 1
    hit = hits[0]
    assert hit["modality"] == "image_caption"
    assert hit["image_source_url"] == "https://images.ctfassets.net/tutorials/reset-step-1.png"
    assert hit["image_asset_path"] == "org/kb/hash.png"
    assert hit["section_heading"] == "Reset password"


@pytest.mark.asyncio
async def test_search_chunks_excludes_filtered_modalities(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    kb_id = uuid.uuid4()
    chunk_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    fake_chunk = SimpleNamespace(
        id=chunk_id,
        document_id=doc_id,
        knowledge_base_id=kb_id,
        content_text="Screenshot caption",
        embedding=[0.2, 0.1],
        metadata_json={"modality": "image_caption"},
    )
    fake_doc = SimpleNamespace(
        id=doc_id,
        source_id=uuid.uuid4(),
        title="Reset password",
        canonical_url="https://docs.example.com/help/reset-password",
    )

    class _SearchDB:
        def __init__(self):
            self._kb = SimpleNamespace(
                id=kb_id,
                embedding_provider=None,
                embedding_model=None,
                embedding_api_base=None,
                embedding_api_key_encrypted=None,
            )

        async def execute(self, _query):  # noqa: ANN001
            query_text = str(_query)
            if "knowledge_documents" in query_text:
                return _DummyScalarResult([fake_doc])
            return _DummyScalarResult([self._kb])

    async def _fake_load_chunks(db, kb_ids):  # noqa: ANN001
        assert db is not None
        assert kb_ids == [kb_id]
        return [fake_chunk]

    async def _fake_embed_texts(texts, runtime):  # noqa: ANN001
        assert texts == ["reset password"]
        assert runtime is None
        return [[0.2, 0.1]]

    async def _fake_lexical_ranks(db, kb_ids, query, limit):  # noqa: ANN001
        assert db is not None
        assert kb_ids == [kb_id]
        assert query == "reset password"
        assert limit > 0
        return ({chunk_id: 1}, {chunk_id: 0.8})

    monkeypatch.setattr(search_service, "_load_chunks_for_kbs", _fake_load_chunks)
    monkeypatch.setattr(search_service, "embed_texts", _fake_embed_texts)
    monkeypatch.setattr(search_service, "_load_postgres_lexical_ranks", _fake_lexical_ranks)

    hits = await search_service.search_chunks(
        db=_SearchDB(),
        organization_id=uuid.uuid4(),
        kb_ids=[kb_id],
        query="reset password",
        limit=5,
        exclude_modalities=["image_caption"],
    )

    assert hits == []
