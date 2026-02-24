def test_audit_router_is_mounted():
    from ios_app_agent.main import app

    routes = [route.path for route in app.routes]
    assert any("/audit-events" in route for route in routes)
