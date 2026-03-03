from pathlib import Path


def test_dashboard_copilot_provider_component_exists() -> None:
    provider = Path("dashboard/src/components/PlaybookCopilotProvider.tsx")
    assert provider.exists()

    text = provider.read_text(encoding="utf-8")
    assert "PlaybookProvider" in text
    assert "PlaybookApprovalWidget" not in text
    assert "NEXT_PUBLIC_PLAYBOOK_KEY" in text
    assert "apiKey={PLAYBOOK_API_KEY}" in text
    assert "appId={boundAppId ?? undefined}" in text
    assert "/v1/copilot/runtime-token" not in text
    assert 'mode: "tokenProvider"' not in text
    assert "data-resolvekit-id" in text


def test_dashboard_app_mounts_copilot_provider_inside_router() -> None:
    text = Path("dashboard/src/dashboard-app.tsx").read_text(encoding="utf-8")
    assert "PlaybookCopilotProvider" in text
    assert "<PlaybookCopilotProvider>" in text


def test_dashboard_env_example_has_playbook_api_key_vars() -> None:
    text = Path(".env.example").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_PLAYBOOK_ENABLED" in text
    assert "NEXT_PUBLIC_PLAYBOOK_KEY" in text
    assert "NEXT_PUBLIC_PLAYBOOK_AGENT_BASE_URL" in text
    assert "IAA_DASHBOARD_RUNTIME_TOKEN_SECRET" not in text
    assert "IAA_DASHBOARD_RUNTIME_TOKEN_AUDIENCE" not in text


def test_dashboard_readme_documents_playbook_api_key_config() -> None:
    text = Path("dashboard/README.md").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_PLAYBOOK_KEY" in text
    assert "IAA_DASHBOARD_RUNTIME_TOKEN_SECRET" not in text


def test_dashboard_has_key_playbook_highlight_ids_for_onboarding_guidance() -> None:
    layout = Path("dashboard/src/components/Layout.tsx").read_text(encoding="utf-8")
    sidebar = Path("dashboard/src/components/AppSidebar.tsx").read_text(encoding="utf-8")
    guide = Path("dashboard/src/components/OnboardingGuideRail.tsx").read_text(encoding="utf-8")
    apps = Path("dashboard/src/dashboard_pages/Apps.tsx").read_text(encoding="utf-8")

    assert "nav-knowledge-bases" in layout
    assert "sidebar-" in sidebar
    assert "onboarding-step-" in guide
    assert "create-app-btn" in apps
