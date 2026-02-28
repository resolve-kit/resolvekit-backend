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
