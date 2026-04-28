from pathlib import Path


def test_dashboard_oss_build_has_no_copilot_provider_component() -> None:
    assert not Path("dashboard/src/components/ResolveKitCopilotProvider.tsx").exists()


def test_dashboard_app_drops_copilot_provider_wrapper() -> None:
    text = Path("dashboard/src/dashboard-app.tsx").read_text(encoding="utf-8")
    assert "ResolveKitCopilotProvider" not in text
    assert "<Routes>" in text


def test_dashboard_env_example_drops_proprietary_copilot_vars() -> None:
    text = Path(".env.example").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_RESOLVEKIT_ENABLED" not in text
    assert "RESOLVEKIT_KEY" not in text
    assert "NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL" not in text
    assert "RESOLVEKIT_NEXTJS_SDK_PATH" not in text


def test_dashboard_readme_drops_proprietary_copilot_setup() -> None:
    text = Path("dashboard/README.md").read_text(encoding="utf-8")
    assert "RESOLVEKIT_KEY" not in text
    assert "/api/resolvekit/token" not in text
    assert "@resolvekit/nextjs" not in text


def test_dashboard_oss_build_has_no_token_proxy_route() -> None:
    assert not Path("dashboard/src/app/api/resolvekit/token/route.ts").exists()


def test_dashboard_oss_build_has_no_action_marker_component() -> None:
    assert not Path("dashboard/src/components/ActionMarker.tsx").exists()


def test_dashboard_oss_build_has_no_embedded_sdk_marker_attributes_or_wrapper_imports() -> None:
    layout = Path("dashboard/src/components/Layout.tsx").read_text(encoding="utf-8")
    sidebar = Path("dashboard/src/components/AppSidebar.tsx").read_text(encoding="utf-8")
    guide = Path("dashboard/src/components/OnboardingGuideRail.tsx").read_text(encoding="utf-8")
    apps = Path("dashboard/src/dashboard_pages/Apps.tsx").read_text(encoding="utf-8")
    api_keys = Path("dashboard/src/dashboard_pages/ApiKeys.tsx").read_text(encoding="utf-8")
    knowledge_bases = Path("dashboard/src/dashboard_pages/KnowledgeBases.tsx").read_text(encoding="utf-8")
    org_admin = Path("dashboard/src/dashboard_pages/OrganizationAdmin.tsx").read_text(encoding="utf-8")
    llm_config = Path("dashboard/src/dashboard_pages/LlmConfig.tsx").read_text(encoding="utf-8")

    for text in [layout, sidebar, guide, apps, api_keys, knowledge_bases, org_admin, llm_config]:
        assert "data-resolvekit-id" not in text
        assert 'from "../components/ActionMarker"' not in text
        assert 'from "../components/ResolveKitAction"' not in text
        assert "@resolvekit/nextjs/react" not in text
