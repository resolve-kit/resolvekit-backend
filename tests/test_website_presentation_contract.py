from pathlib import Path


PRESENTATION_PAGE_PATH = Path("website/src/app/presentation/page.tsx")
PRESENTATION_NAV_PATH = Path("website/src/app/presentation/nav.tsx")

VIDEO_PATHS = [
    Path("website/public/presentation/MOV_6069.mp4"),
    Path("website/public/presentation/MOV_2877.mp4"),
    Path("website/public/presentation/ResolveKit_console_llms.mp4"),
]


def test_presentation_route_exists_with_pitch_content_and_embedded_demos() -> None:
    page = PRESENTATION_PAGE_PATH.read_text()
    nav = PRESENTATION_NAV_PATH.read_text()

    assert "Support is moving into the product." in page
    assert "ResolveKit is the embedded resolution layer." in page
    assert "The shift is from support that explains to support that resolves." in page
    assert "The future is in-app resolution." in page
    assert "Legacy support surface" in page
    assert "In-app resolution surface" in page
    assert "Explains after the workflow breaks." in page
    assert "Resolves while the workflow is still live." in page
    assert 'id="validation"' not in page
    assert '"#validation"' not in nav
    assert '{ href: "#validation", label: "Proof" }' not in nav
    assert "Go-to-market" in page
    assert "The wedge starts with one embedded workflow." in page
    assert "Install" in page
    assert "Prove" in page
    assert "Expand" in page
    assert "Competition" in page
    assert "Incumbents sell helpdesk automation. ResolveKit owns in-app resolution." in page
    assert "Public band: $0.80-$1.50+" in page
    assert "ResolveKit target: $0.20" in page
    assert "Show public competitor snapshot" in page
    assert 'id="economics"' in page
    assert 'id="relevance"' in page
    assert "Intercom Fin" in page
    assert "Sierra" in page
    assert "Decagon" in page
    assert "PostHog" in page
    assert "Price far below incumbents. Keep margin structurally high." in page
    assert "Show cost build" in page
    assert "Most sessions land much lower." in page
    assert "The delivery cost is measured in cents." in page
    assert "~$0.005" in page
    assert "10×" in page
    assert "$0.20" in page
    assert "$0.99" in page
    assert "Gemini 2.5 Flash-Lite" in page
    assert "Model cost is not the bottleneck." in page
    assert "The moat is workflow ownership." in page
    assert "Better chat will spread. Embedded control is harder to replace." in page
    assert "Embedded context plus approved action." in page
    assert "Show sizing and signals" in page
    assert "Open direct file" in page
    assert "This only needs one final point" not in page
    assert "PMF half-life" in page
    assert "MOV_6069.mp4" in page
    assert "MOV_2877.mp4" in page
    assert "ResolveKit_console_llms.mp4" in page
    assert 'aspect: "landscape"' in page
    assert "beedback" not in page.lower()


def test_presentation_demo_videos_are_published_in_website_public_dir() -> None:
    for video_path in VIDEO_PATHS:
        assert video_path.exists(), f"missing video asset: {video_path}"
