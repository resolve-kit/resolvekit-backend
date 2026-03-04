from pathlib import Path


HOME_PAGE_PATH = Path("website/src/app/page.tsx")
PRICING_PAGE_PATH = Path("website/src/app/pricing/page.tsx")
URLS_PATH = Path("website/src/lib/urls.ts")
HERO_PREVIEW_COMPONENT_PATH = Path("website/src/components/hero-chat-preview.tsx")

FREE_LABEL = "Free (for now)"
FEEDBACK_LABEL = "Pay us in feedback"
ISSUES_URL = "https://github.com/Nights-Are-Late/resolvekit-ios-sdk/issues"


def test_free_plan_feedback_copy_exists_on_home_and_pricing_pages() -> None:
    home_page = HOME_PAGE_PATH.read_text()
    pricing_page = PRICING_PAGE_PATH.read_text()
    urls_file = URLS_PATH.read_text()

    assert FREE_LABEL in home_page
    assert FREE_LABEL in pricing_page
    assert FEEDBACK_LABEL in home_page
    assert FEEDBACK_LABEL in pricing_page
    assert ISSUES_URL in urls_file
    assert "feedbackIssuesUrl" in home_page
    assert "feedbackIssuesUrl" in pricing_page


def test_homepage_hero_chat_preview_exists_with_function_call_flow() -> None:
    home_page = HOME_PAGE_PATH.read_text()
    hero_preview = HERO_PREVIEW_COMPONENT_PATH.read_text()

    assert "HeroChatPreview" in home_page
    assert "opened the assistant chat" in hero_preview
    assert "function call" in hero_preview.lower()
    assert "reindex_activity_timeline" in hero_preview
    assert "Approve" in hero_preview
    assert "Is timeline loading in the app now?" in hero_preview
