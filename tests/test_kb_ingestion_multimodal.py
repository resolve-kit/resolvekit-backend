import uuid

import pytest

from knowledge_bases.models import KnowledgeDocument
from knowledge_bases.services.crawling import CrawledImage, CrawledPage
from knowledge_bases.services.embedding import EmbeddingRuntimeConfig
from knowledge_bases.services.ingestion import build_image_assets_and_chunks
from knowledge_bases.services.multimodal import RankedImageCandidate


@pytest.mark.asyncio
async def test_build_image_assets_and_chunks_links_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    page = CrawledPage(
        url="https://docs.example.com/help/reset-password",
        title="Reset password",
        content_markdown="Reset password tutorial",
        images=[
            CrawledImage(
                url="https://images.ctfassets.net/tutorials/reset-step-1.png",
                alt_text="Settings account screen",
                title_text=None,
                context_text="Step 1: Open Settings and tap Account.",
                section_heading="Reset password",
                dom_index=1,
                width=1170,
                height=720,
                in_chrome=False,
                css_class=None,
                element_id=None,
            )
        ],
    )

    org_id = uuid.uuid4()
    kb_id = uuid.uuid4()
    source_id = uuid.uuid4()
    doc = KnowledgeDocument(
        knowledge_base_id=kb_id,
        source_id=source_id,
        canonical_url=page.url,
        title=page.title,
        content_markdown=page.content_markdown,
        content_hash="content-hash",
        metadata_json={},
    )
    doc.id = uuid.uuid4()

    monkeypatch.setattr(
        "knowledge_bases.services.ingestion.select_relevant_images",
        lambda images, max_images: [RankedImageCandidate(image=images[0], score=5.0)],
    )

    async def _fake_download(url: str):  # noqa: ANN001
        assert "ctfassets" in url
        return (b"fake-image-bytes", "image/png")

    monkeypatch.setattr("knowledge_bases.services.ingestion.download_image_bytes", _fake_download)
    monkeypatch.setattr(
        "knowledge_bases.services.ingestion.persist_image_asset",
        lambda **kwargs: ("org/kb/hash.png", "abc123", "image/png"),
    )
    monkeypatch.setattr(
        "knowledge_bases.services.ingestion.extract_ocr_text",
        lambda image_bytes: "Tap Settings",
    )

    async def _fake_caption(**kwargs):  # noqa: ANN001
        return "Screenshot shows account settings panel"

    monkeypatch.setattr("knowledge_bases.services.ingestion.generate_caption_with_vision_model", _fake_caption)

    async def _fake_embed_texts(texts, runtime):  # noqa: ANN001
        assert runtime is not None
        return [[0.1, 0.2] for _ in texts]

    monkeypatch.setattr("knowledge_bases.services.ingestion.embed_texts", _fake_embed_texts)

    runtime = EmbeddingRuntimeConfig(
        provider="openai",
        model="text-embedding-3-small",
        api_key="test-key",
        api_base=None,
    )
    assets, chunks = await build_image_assets_and_chunks(
        organization_id=org_id,
        knowledge_base_id=kb_id,
        source_id=source_id,
        document=doc,
        page=page,
        runtime=runtime,
        starting_chunk_index=3,
    )

    assert len(assets) == 1
    asset = assets[0]
    assert asset.source_image_url == "https://images.ctfassets.net/tutorials/reset-step-1.png"
    assert asset.storage_path == "org/kb/hash.png"
    assert asset.relevance_score == 5.0
    assert asset.parent_document_url == page.url

    assert len(chunks) == 2
    modalities = {chunk.metadata_json.get("modality") for chunk in chunks}
    assert modalities == {"image_ocr", "image_caption"}
    for chunk in chunks:
        assert chunk.metadata_json.get("image_asset_path") == "org/kb/hash.png"
        assert chunk.metadata_json.get("image_source_url") == "https://images.ctfassets.net/tutorials/reset-step-1.png"
        assert chunk.metadata_json.get("parent_canonical_url") == page.url
        assert chunk.chunk_index >= 3
