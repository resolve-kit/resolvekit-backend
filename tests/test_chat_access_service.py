import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from agent.services.chat_access_service import (
    CHAT_UNAVAILABLE_CODE,
    CHAT_UNAVAILABLE_MESSAGE,
    chat_unavailable_http_exception,
    is_chat_unavailable_provider_error,
    issue_chat_capability_token,
    validate_chat_capability_token,
)


def _app(*, integration_enabled: bool = True, integration_version: int = 1) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        integration_enabled=integration_enabled,
        integration_version=integration_version,
    )


def test_chat_unavailable_http_exception_shape() -> None:
    exc = chat_unavailable_http_exception()
    assert exc.status_code == 403
    assert isinstance(exc.detail, dict)
    assert exc.detail == {"code": CHAT_UNAVAILABLE_CODE, "message": CHAT_UNAVAILABLE_MESSAGE}


def test_chat_capability_token_validates_for_same_session_and_version() -> None:
    app = _app(integration_enabled=True, integration_version=3)
    session_id = uuid.uuid4()
    token = issue_chat_capability_token(session_id=session_id, app=app, ttl_seconds=120)
    validate_chat_capability_token(token=token, session_id=session_id, app=app)


def test_chat_capability_token_rejected_when_integration_version_changes() -> None:
    app = _app(integration_enabled=True, integration_version=4)
    session_id = uuid.uuid4()
    token = issue_chat_capability_token(session_id=session_id, app=app, ttl_seconds=120)

    app.integration_version = 5

    with pytest.raises(HTTPException) as exc_info:
        validate_chat_capability_token(token=token, session_id=session_id, app=app)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {"code": CHAT_UNAVAILABLE_CODE, "message": CHAT_UNAVAILABLE_MESSAGE}


def test_chat_capability_token_rejected_when_integration_disabled() -> None:
    app = _app(integration_enabled=True, integration_version=1)
    session_id = uuid.uuid4()
    token = issue_chat_capability_token(session_id=session_id, app=app, ttl_seconds=120)

    app.integration_enabled = False

    with pytest.raises(HTTPException) as exc_info:
        validate_chat_capability_token(token=token, session_id=session_id, app=app)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == {"code": CHAT_UNAVAILABLE_CODE, "message": CHAT_UNAVAILABLE_MESSAGE}


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("insufficient_quota", True),
        ("rate_limit_exceeded", True),
        ("invalid_api_key", True),
        ("provider unavailable", False),
    ],
)
def test_is_chat_unavailable_provider_error_uses_safe_classification(message: str, expected: bool) -> None:
    assert is_chat_unavailable_provider_error(RuntimeError(message)) is expected
