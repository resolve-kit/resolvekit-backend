import uuid

import pytest

from kb_service.services import search as search_service


class _DummyDB:
    pass


@pytest.mark.asyncio
async def test_search_chunks_handles_empty_chunk_set_without_crashing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_embed_texts(db, organization_id, texts):  # noqa: ANN001
        assert db is not None
        assert texts == ["reset password"]
        return [[0.1, 0.2]]

    async def fake_load_chunks(db, kb_ids):  # noqa: ANN001
        assert db is not None
        assert len(kb_ids) == 1
        return []

    monkeypatch.setattr(search_service, "embed_texts", fake_embed_texts)
    monkeypatch.setattr(search_service, "_load_chunks_for_kbs", fake_load_chunks)

    result = await search_service.search_chunks(
        db=_DummyDB(),
        organization_id=uuid.uuid4(),
        kb_ids=[uuid.uuid4()],
        query="reset password",
        limit=5,
    )

    assert result == []
