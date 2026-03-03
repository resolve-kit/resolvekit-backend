from pathlib import Path


def test_dashboard_login_persists_access_token_for_api_auth() -> None:
    text = Path("dashboard/src/dashboard_pages/Login.tsx").read_text(encoding="utf-8")
    assert "setToken(res.access_token);" in text


def test_dashboard_api_client_forces_same_origin_for_session_cookie_routes() -> None:
    text = Path("dashboard/src/api/client.ts").read_text(encoding="utf-8")
    assert '"/v1/auth/login"' in text
    assert '"/v1/auth/signup"' in text
    assert '"/v1/auth/me"' in text
    assert "shouldUseSameOriginAuthRoute(path) ? path : `${BASE}${path}`" in text
