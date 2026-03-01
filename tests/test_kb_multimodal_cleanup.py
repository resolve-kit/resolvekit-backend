from types import SimpleNamespace
import uuid

import pytest

from knowledge_bases.services.ingestion import (
    cleanup_image_assets_for_document,
    cleanup_image_assets_for_source,
)


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class _DummyDB:
    def __init__(self, assets):
        self.assets = assets
        self.delete_calls = 0

    async def execute(self, statement):  # noqa: ANN001
        if getattr(statement, "is_select", False):
            return _ScalarResult(self.assets)
        if getattr(statement, "is_delete", False):
            self.delete_calls += 1
            return _ScalarResult([])
        return _ScalarResult([])


@pytest.mark.asyncio
async def test_cleanup_image_assets_for_source_removes_files(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    monkeypatch.setattr("knowledge_bases.services.multimodal.settings.multimodal_assets_dir", str(tmp_path))
    relative_path = "org/kb/asset.png"
    absolute_path = tmp_path / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    absolute_path.write_bytes(b"image-bytes")

    db = _DummyDB([SimpleNamespace(storage_path=relative_path)])
    count = await cleanup_image_assets_for_source(db, source_id=uuid.uuid4())

    assert count == 1
    assert db.delete_calls == 1
    assert not absolute_path.exists()


@pytest.mark.asyncio
async def test_cleanup_image_assets_for_document_removes_files(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    monkeypatch.setattr("knowledge_bases.services.multimodal.settings.multimodal_assets_dir", str(tmp_path))
    relative_path = "org/kb/asset-2.png"
    absolute_path = tmp_path / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    absolute_path.write_bytes(b"image-bytes")

    db = _DummyDB([SimpleNamespace(storage_path=relative_path)])
    count = await cleanup_image_assets_for_document(db, document_id=uuid.uuid4())

    assert count == 1
    assert db.delete_calls == 1
    assert not absolute_path.exists()
