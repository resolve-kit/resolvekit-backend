import uuid
from unittest.mock import AsyncMock

import pytest

from knowledge_bases.services.crawling import CrawledImage
from knowledge_bases.services.embedding import EmbeddingRuntimeConfig
from knowledge_bases.services.multimodal import (
    build_asset_relpath,
    generate_caption_with_vision_model,
    score_image_candidate,
    select_relevant_images,
)


def _image(
    *,
    url: str,
    alt: str | None = None,
    context: str | None = None,
    heading: str | None = None,
    in_chrome: bool = False,
    width: int | None = None,
    height: int | None = None,
) -> CrawledImage:
    return CrawledImage(
        url=url,
        alt_text=alt,
        title_text=None,
        context_text=context,
        section_heading=heading,
        dom_index=1,
        width=width,
        height=height,
        in_chrome=in_chrome,
        css_class=None,
        element_id=None,
    )


def test_score_image_candidate_downranks_decorative_chrome_images() -> None:
    decorative = _image(
        url="https://cdn.example.com/logo-icon.png",
        alt="Company logo",
        context=None,
        heading=None,
        in_chrome=True,
        width=24,
        height=24,
    )
    tutorial = _image(
        url="https://cdn.example.com/tutorial-step-1.png",
        alt="Tap Settings then Account",
        context="Step 1: Open Settings and tap Account.",
        heading="Reset password",
        width=1170,
        height=720,
    )

    assert score_image_candidate(tutorial) > score_image_candidate(decorative)


def test_select_relevant_images_keeps_top_six() -> None:
    images = [
        _image(
            url=f"https://images.example.com/tutorial-step-{idx}.png",
            alt=f"Step {idx} screenshot",
            context=f"Step {idx}: tap next",
            heading="Tutorial flow",
            width=1200,
            height=700,
        )
        for idx in range(1, 9)
    ]

    selected = select_relevant_images(images, max_images=6)

    assert len(selected) == 6
    assert all(item.score > 0 for item in selected)


def test_build_asset_relpath_is_hash_keyed_and_deterministic() -> None:
    org_id = uuid.uuid4()
    kb_id = uuid.uuid4()
    relpath_1 = build_asset_relpath(
        organization_id=org_id,
        knowledge_base_id=kb_id,
        content_hash="abc123",
        extension=".png",
    )
    relpath_2 = build_asset_relpath(
        organization_id=org_id,
        knowledge_base_id=kb_id,
        content_hash="abc123",
        extension=".png",
    )

    assert relpath_1 == relpath_2
    assert str(org_id) in relpath_1
    assert str(kb_id) in relpath_1
    assert relpath_1.endswith("abc123.png")


@pytest.mark.asyncio
async def test_generate_caption_retries_without_temperature(monkeypatch: pytest.MonkeyPatch) -> None:
    class UnsupportedParamsError(Exception):
        pass

    completion_mock = AsyncMock(
        side_effect=[
            UnsupportedParamsError("model does not support temperature"),
            {"choices": [{"message": {"content": "Tap Settings, then Account to continue."}}]},
        ]
    )
    monkeypatch.setattr("knowledge_bases.services.llm_compat.litellm.acompletion", completion_mock)

    runtime = EmbeddingRuntimeConfig(
        provider="openai",
        model="text-embedding-3-small",
        api_key="test-key",
        api_base=None,
    )
    caption = await generate_caption_with_vision_model(
        runtime=runtime,
        image_bytes=b"\x89PNG",
        mime_type="image/png",
        context_text="Tutorial step for account settings.",
    )

    assert caption == "Tap Settings, then Account to continue."
    assert completion_mock.await_count == 2
    assert completion_mock.await_args_list[0].kwargs.get("temperature") == 0
    assert "temperature" not in completion_mock.await_args_list[1].kwargs
