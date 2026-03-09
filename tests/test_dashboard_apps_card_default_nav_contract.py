from pathlib import Path


def test_apps_card_navigates_to_default_app_page_on_card_click() -> None:
    text = Path("dashboard/src/dashboard_pages/Apps.tsx").read_text(encoding="utf-8")

    assert "const APP_DEFAULT_SLUG = APP_NAV_ITEMS[0]?.slug ?? \"llm\";" in text
    assert "if (target.closest(\"a, button, input, textarea, select, label\")) return;" in text
    assert "navigate(`/apps/${appId}/${APP_DEFAULT_SLUG}`);" in text


def test_apps_card_exposes_explicit_delete_control_metadata() -> None:
    text = Path("dashboard/src/dashboard_pages/Apps.tsx").read_text(encoding="utf-8")

    assert "data-resolvekit-id={`delete-app-${app.id}`}" in text
    assert 'aria-label={`Delete ${app.name} app`}' in text
    assert "sm:group-focus-within:opacity-100" in text
