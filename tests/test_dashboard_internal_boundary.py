import pytest
from fastapi import HTTPException

from agent.config import settings
from agent.middleware.dashboard_internal import require_dashboard_internal_token


def test_dashboard_internal_token_is_noop_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dashboard_internal_token", None)
    require_dashboard_internal_token()


def test_dashboard_internal_token_rejects_missing_header(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dashboard_internal_token", "internal-secret")
    with pytest.raises(HTTPException) as exc_info:
        require_dashboard_internal_token()
    assert exc_info.value.status_code == 403


def test_dashboard_internal_token_accepts_valid_header(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dashboard_internal_token", "internal-secret")
    require_dashboard_internal_token(x_internal_dashboard_token="internal-secret")
