from pathlib import Path


def test_dashboard_copilot_provider_component_exists() -> None:
    provider = Path("dashboard/src/components/ResolveKitCopilotProvider.tsx")
    assert provider.exists()

    text = provider.read_text(encoding="utf-8")
    assert "ResolveKitProvider" in text
    assert "ResolveKitWidget" in text
    assert "ResolveKitDevtools" in text
    assert "ResolveKitApprovalWidget" not in text
    assert "NEXT_PUBLIC_RESOLVEKIT_KEY" not in text
    assert "createClientTokenAuthProvider({ endpoint: \"/api/resolvekit/token\" })" in text
    assert "appId={boundAppId ?? undefined}" not in text
    assert "/v1/copilot/runtime-token" not in text
    assert 'mode: "tokenProvider"' not in text


def test_dashboard_app_mounts_copilot_provider_inside_router() -> None:
    text = Path("dashboard/src/dashboard-app.tsx").read_text(encoding="utf-8")
    assert "ResolveKitCopilotProvider" in text
    assert "<ResolveKitCopilotProvider>" in text


def test_dashboard_env_example_has_playbook_api_key_vars() -> None:
    text = Path(".env.example").read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_RESOLVEKIT_ENABLED" in text
    assert "RESOLVEKIT_KEY" in text
    assert "NEXT_PUBLIC_RESOLVEKIT_KEY" not in text
    assert "NEXT_PUBLIC_RESOLVEKIT_AGENT_BASE_URL" in text
    assert "IAA_DASHBOARD_RUNTIME_TOKEN_SECRET" not in text
    assert "IAA_DASHBOARD_RUNTIME_TOKEN_AUDIENCE" not in text


def test_dashboard_readme_documents_playbook_api_key_config() -> None:
    text = Path("dashboard/README.md").read_text(encoding="utf-8")
    assert "RESOLVEKIT_KEY" in text
    assert "/api/resolvekit/token" in text
    assert "IAA_DASHBOARD_RUNTIME_TOKEN_SECRET" not in text


def test_dashboard_has_key_playbook_highlight_ids_for_onboarding_guidance() -> None:
    layout = Path("dashboard/src/components/Layout.tsx").read_text(encoding="utf-8")
    sidebar = Path("dashboard/src/components/AppSidebar.tsx").read_text(encoding="utf-8")
    guide = Path("dashboard/src/components/OnboardingGuideRail.tsx").read_text(encoding="utf-8")
    apps = Path("dashboard/src/dashboard_pages/Apps.tsx").read_text(encoding="utf-8")
    org_admin = Path("dashboard/src/dashboard_pages/OrganizationAdmin.tsx").read_text(encoding="utf-8")
    functions = Path("dashboard/src/dashboard_pages/Functions.tsx").read_text(encoding="utf-8")

    assert "nav-knowledge-bases" in layout
    assert "sidebar-" in sidebar
    assert "onboarding-step-" in guide
    assert "create-app-btn" in apps
    assert "delete-app-" in apps
    assert "aria-label={`Delete ${app.name} app`}" in apps
    assert "delete-app-confirm-btn" in apps
    assert "org-view-llm-setup" in org_admin
    assert "create-org-llm-profile-btn" in org_admin
    assert "invite-member-btn" in org_admin
    assert "functions-list" in functions
    assert "function-card-" in functions
    assert "toggle-function-" in functions


def test_dashboard_copilot_provider_uses_capability_manifest() -> None:
    provider = Path("dashboard/src/components/ResolveKitCopilotProvider.tsx").read_text(encoding="utf-8")
    manifest = Path("dashboard/src/lib/resolvekit/dashboardCapabilities.ts")

    assert manifest.exists()
    manifest_text = manifest.read_text(encoding="utf-8")

    assert "list_dashboard_routes" in provider
    assert "get_dashboard_context" in provider
    assert "get_onboarding_status" in provider
    assert "list_app_workspaces" in provider
    assert "delete_app_workspace" in provider
    assert "current_route_id" in provider
    assert "required_onboarding_step_ids" in provider
    assert "DASHBOARD_ROUTE_DEFINITIONS" in manifest_text
    assert "actionIds" in manifest_text
