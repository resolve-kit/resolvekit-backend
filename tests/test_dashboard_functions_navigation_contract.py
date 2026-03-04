from pathlib import Path


def test_app_sidebar_agent_section_includes_functions_tab() -> None:
    text = Path("dashboard/src/components/AppSidebar.tsx").read_text(encoding="utf-8")

    assert 'const AGENT_CHILD_ITEMS: NavItem[] = [' in text
    assert '{ label: "Functions", slug: "functions" }' in text


def test_app_nav_tabs_include_functions_tab() -> None:
    text = Path("dashboard/src/components/ui/AppNav.tsx").read_text(encoding="utf-8")

    assert "const TABS = [" in text
    assert '{ label: "Functions", slug: "functions" }' in text
