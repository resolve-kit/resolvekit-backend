from types import SimpleNamespace

from agent.services.compatibility_service import function_is_eligible


def test_function_is_eligible_requires_session_allowlist_membership() -> None:
    fn = SimpleNamespace(
        name="capture_photo",
        is_active=True,
        availability={},
    )
    session = SimpleNamespace(
        client_context={"platform": "ios", "os_version": "18.0", "app_version": "1.0.0"},
        available_function_names=["capture_photo"],
    )

    assert function_is_eligible(fn, session) is True


def test_function_is_eligible_rejects_function_not_in_session_allowlist() -> None:
    fn = SimpleNamespace(
        name="capture_photo",
        is_active=True,
        availability={},
    )
    session = SimpleNamespace(
        client_context={"platform": "ios", "os_version": "18.0", "app_version": "1.0.0"},
        available_function_names=["lookup_weather"],
    )

    assert function_is_eligible(fn, session) is False
