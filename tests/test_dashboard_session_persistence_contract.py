from pathlib import Path


def test_dashboard_login_persists_access_token_for_api_auth() -> None:
    text = Path("dashboard/src/dashboard_pages/Login.tsx").read_text(encoding="utf-8")
    assert "setToken(res.access_token);" in text


def test_dashboard_api_client_forces_same_origin_for_all_routes() -> None:
    text = Path("dashboard/src/api/client.ts").read_text(encoding="utf-8")
    assert '"/v1/auth/login"' in text
    assert '"/v1/auth/signup"' in text
    assert '"/v1/auth/me"' in text
    # `dashboard` and `api` are the same Next.js app/image in every deploy
    # topology, so every request (not just cookie-bound auth routes) must go
    # same-origin rather than a build-time NEXT_PUBLIC_API_BASE_URL, which is
    # baked once in CI and would otherwise misroute non-prod deployments.
    assert "function toRequestUrl(path: string): string {\n  " in text
    assert "return path;" in text
