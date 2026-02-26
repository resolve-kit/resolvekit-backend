from pathlib import Path


def test_layout_mounts_onboarding_guide_rail() -> None:
    text = Path("dashboard/src/components/Layout.tsx").read_text(encoding="utf-8")
    assert "OnboardingGuideRail" in text


def test_apps_page_no_longer_uses_new_app_checklist_banner() -> None:
    text = Path("dashboard/src/pages/Apps.tsx").read_text(encoding="utf-8")
    assert "newAppChecklistId" not in text
    assert "Setup needed for" not in text
