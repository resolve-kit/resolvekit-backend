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
