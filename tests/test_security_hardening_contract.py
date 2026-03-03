from pathlib import Path


def test_agent_disables_legacy_ws_api_key_by_default() -> None:
    text = Path("agent/config.py").read_text(encoding="utf-8")
    assert "allow_legacy_ws_api_key: bool = False" in text


def test_dashboard_api_client_does_not_blanket_whitelist_auth_prefix() -> None:
    text = Path("dashboard/src/api/client.ts").read_text(encoding="utf-8")
    assert "path.startsWith(\"/v1/auth/\")" not in text
    assert '"/v1/auth/login"' in text
    assert '"/v1/auth/signup"' in text
    assert '"/v1/auth/password-guidance"' in text


def test_dashboard_has_logout_route_and_uses_cookie_clear() -> None:
    route = Path("dashboard/src/app/v1/auth/logout/route.ts")
    assert route.exists()
    route_text = route.read_text(encoding="utf-8")
    assert "clearDashboardSessionCookie" in route_text



def test_dashboard_layout_verifies_server_session() -> None:
    text = Path("dashboard/src/components/Layout.tsx").read_text(encoding="utf-8")
    assert "api(\"/v1/auth/me\")" in text



def test_dashboard_proxy_requires_session_cookie_for_shell_paths() -> None:
    text = Path("dashboard/src/proxy.ts").read_text(encoding="utf-8")
    assert "dashboard_token" in text
    assert "NextResponse.redirect" in text



def test_dashboard_auth_module_has_no_default_jwt_secret_fallback() -> None:
    text = Path("dashboard/src/lib/server/auth.ts").read_text(encoding="utf-8")
    assert '?? "change-me-in-production"' not in text



def test_dashboard_provider_validates_custom_api_base() -> None:
    provider_text = Path("dashboard/src/lib/server/provider.ts").read_text(encoding="utf-8")
    create_text = Path("dashboard/src/app/v1/organizations/llm-profiles/route.ts").read_text(encoding="utf-8")
    update_text = Path("dashboard/src/app/v1/organizations/llm-profiles/[profileId]/route.ts").read_text(encoding="utf-8")
    assert "validateProviderApiBase" in provider_text
    assert "validateProviderApiBase" in create_text
    assert "validateProviderApiBase" in update_text
