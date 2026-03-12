from pathlib import Path


PRESENTATION_PAGE_PATH = Path("website/src/app/presentation/page.tsx")

VIDEO_PATHS = [
    Path("website/public/presentation/MOV_6069.mp4"),
    Path("website/public/presentation/MOV_2877.mp4"),
    Path("website/public/presentation/ResolveKit_console_llms.mp4"),
]


def test_presentation_route_exists_with_pitch_content_and_embedded_demos() -> None:
    page = PRESENTATION_PAGE_PATH.read_text()

    assert "Everyone has a chatbot" in page
    assert "SDK" in page
    assert "multimodal knowledge base" in page.lower()
    assert "deeper integration" in page.lower()
    assert "Go-to-market" in page
    assert "Competition" in page
    assert "Intercom Fin" in page
    assert "Sierra" in page
    assert "Decagon" in page
    assert "PostHog" in page
    assert "250M" in page or "250m" in page
    assert "MOV_6069.mp4" in page
    assert "MOV_2877.mp4" in page
    assert "ResolveKit_console_llms.mp4" in page
    assert 'aspect: "landscape"' in page
    assert "beedback" not in page.lower()


def test_presentation_demo_videos_are_published_in_website_public_dir() -> None:
    for video_path in VIDEO_PATHS:
        assert video_path.exists(), f"missing video asset: {video_path}"
