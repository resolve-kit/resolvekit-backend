import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from agent.services.sdk_client_token_service import (
    issue_sdk_client_token,
    resolve_sdk_client_token_app_id,
)


def _app(*, integration_version: int = 1) -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), integration_version=integration_version)


def test_issue_and_resolve_sdk_client_token_roundtrip() -> None:
    app = _app(integration_version=3)
    token, expires_at = issue_sdk_client_token(app, ttl_seconds=120)

    assert isinstance(token, str)
    assert token
    assert expires_at is not None
    assert resolve_sdk_client_token_app_id(token=token, app=app) == app.id


def test_sdk_client_token_rejected_on_integration_version_change() -> None:
    app = _app(integration_version=1)
    token, _ = issue_sdk_client_token(app, ttl_seconds=120)
    app.integration_version = 2

    with pytest.raises(HTTPException) as exc_info:
        resolve_sdk_client_token_app_id(token=token, app=app)

    assert exc_info.value.status_code == 401
