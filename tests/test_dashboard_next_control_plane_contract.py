from pathlib import Path


def test_dashboard_next_has_direct_auth_routes() -> None:
    login_route = Path("dashboard/src/app/v1/auth/login/route.ts")
    signup_route = Path("dashboard/src/app/v1/auth/signup/route.ts")
    me_route = Path("dashboard/src/app/v1/auth/me/route.ts")

    assert login_route.exists()
    assert signup_route.exists()
    assert me_route.exists()

    assert "prisma.developerAccount" in login_route.read_text(encoding="utf-8")
    assert "prisma.$transaction" in signup_route.read_text(encoding="utf-8")


def test_dashboard_next_has_direct_apps_routes() -> None:
    apps_route = Path("dashboard/src/app/v1/apps/route.ts")
    app_route = Path("dashboard/src/app/v1/apps/[appId]/route.ts")
    api_keys_route = Path("dashboard/src/app/v1/apps/[appId]/api-keys/route.ts")

    assert apps_route.exists()
    assert app_route.exists()
    assert api_keys_route.exists()

    assert "prisma.app.findMany" in apps_route.read_text(encoding="utf-8")
    assert "prisma.apiKey.findMany" in api_keys_route.read_text(encoding="utf-8")


def test_dashboard_next_has_remaining_control_plane_routes() -> None:
    required_routes = [
        "dashboard/src/app/v1/apps/[appId]/functions/route.ts",
        "dashboard/src/app/v1/apps/[appId]/functions/[functionId]/route.ts",
        "dashboard/src/app/v1/apps/[appId]/playbooks/route.ts",
        "dashboard/src/app/v1/apps/[appId]/playbooks/[playbookId]/route.ts",
        "dashboard/src/app/v1/apps/[appId]/playbooks/[playbookId]/functions/route.ts",
        "dashboard/src/app/v1/apps/[appId]/sessions/route.ts",
        "dashboard/src/app/v1/apps/[appId]/sessions/[sessionId]/messages/route.ts",
        "dashboard/src/app/v1/apps/[appId]/audit-events/route.ts",
        "dashboard/src/app/v1/apps/[appId]/chat-theme/route.ts",
        "dashboard/src/app/v1/apps/[appId]/chat-localizations/route.ts",
        "dashboard/src/app/v1/organizations/me/route.ts",
        "dashboard/src/app/v1/organizations/onboarding/route.ts",
        "dashboard/src/app/v1/organizations/onboarding/reset/route.ts",
        "dashboard/src/app/v1/organizations/members/route.ts",
        "dashboard/src/app/v1/organizations/members/[memberId]/role/route.ts",
        "dashboard/src/app/v1/organizations/invitations/route.ts",
        "dashboard/src/app/v1/organizations/invitations/received/route.ts",
        "dashboard/src/app/v1/organizations/invitations/sent/route.ts",
        "dashboard/src/app/v1/organizations/invitations/[invitationId]/route.ts",
        "dashboard/src/app/v1/organizations/invitations/[invitationId]/accept/route.ts",
        "dashboard/src/app/v1/apps/[appId]/config/route.ts",
        "dashboard/src/app/v1/apps/[appId]/config/providers/route.ts",
        "dashboard/src/app/v1/apps/[appId]/config/models/route.ts",
        "dashboard/src/app/v1/apps/[appId]/config/test/route.ts",
        "dashboard/src/app/v1/organizations/llm/providers/route.ts",
        "dashboard/src/app/v1/organizations/llm-profiles/route.ts",
        "dashboard/src/app/v1/organizations/llm-profiles/[profileId]/route.ts",
        "dashboard/src/app/v1/organizations/llm-models/route.ts",
        "dashboard/src/app/v1/organizations/embedding-models/route.ts",
        "dashboard/src/app/v1/organizations/embedding-profiles/route.ts",
        "dashboard/src/app/v1/organizations/embedding-profiles/[profileId]/route.ts",
        "dashboard/src/app/v1/organizations/embedding-profiles/[profileId]/change-impact/route.ts",
        "dashboard/src/app/v1/knowledge-bases/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/embedding-change-impact/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/sources/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/sources/url/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/sources/upload/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/sources/upload-file/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/sources/[sourceId]/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/sources/[sourceId]/recrawl/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/jobs/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/documents/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/documents/[documentId]/route.ts",
        "dashboard/src/app/v1/knowledge-bases/[kbId]/search/route.ts",
        "dashboard/src/app/v1/apps/[appId]/knowledge-bases/route.ts",
    ]
    missing = [path for path in required_routes if not Path(path).exists()]
    assert not missing, f"Missing Next dashboard routes: {missing}"


def test_dashboard_next_no_longer_uses_control_plane_catch_all() -> None:
    catch_all = Path("dashboard/src/app/v1/[...path]/route.ts")
    assert not catch_all.exists(), "Catch-all dashboard control-plane bridge should be removed"


def test_dashboard_next_routes_do_not_use_agent_forwarding_helper() -> None:
    route_files = sorted(Path("dashboard/src/app/v1").rglob("route.ts"))
    assert route_files, "Expected dashboard Next route files under /v1"
    still_forwarding = [
        str(path)
        for path in route_files
        if "forwardToAgent(" in path.read_text(encoding="utf-8")
    ]
    assert not still_forwarding, f"Routes still forwarding to agent helper: {still_forwarding}"


def test_openapi_export_includes_dashboard_api_artifact() -> None:
    export_script = Path("scripts/export_openapi.py")
    assert export_script.exists()
    text = export_script.read_text(encoding="utf-8")
    assert "dashboard.openapi.json" in text
