from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from agent.routers.sdk import create_sdk_client_token, _sdk_client_token_rate_limit


@pytest.mark.asyncio
async def test_sdk_client_token_endpoint_returns_token_payload() -> None:
    _sdk_client_token_rate_limit.clear()
    app = SimpleNamespace(id="app-id", integration_version=1)
    expires_at = datetime.now(timezone.utc)
    request = SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))
    response = SimpleNamespace(headers={})

    with patch("agent.routers.sdk.issue_sdk_client_token", return_value=("sdk-token", expires_at)):
        payload = await create_sdk_client_token(request=request, response=response, app=app)

    assert payload.token == "sdk-token"
    assert payload.expires_at == expires_at
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Pragma"] == "no-cache"
    assert response.headers["Vary"] == "Origin"


@pytest.mark.asyncio
async def test_sdk_client_token_endpoint_rejects_disallowed_origin() -> None:
    _sdk_client_token_rate_limit.clear()
    app = SimpleNamespace(id="app-id", integration_version=1)
    request = SimpleNamespace(headers={"origin": "https://evil.example"}, client=SimpleNamespace(host="127.0.0.1"))
    response = SimpleNamespace(headers={})

    with pytest.raises(HTTPException) as exc_info:
        await create_sdk_client_token(request=request, response=response, app=app)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_sdk_client_token_endpoint_applies_rate_limit() -> None:
    _sdk_client_token_rate_limit.clear()
    app = SimpleNamespace(id="app-id", integration_version=1)
    request = SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))
    response = SimpleNamespace(headers={})
    expires_at = datetime.now(timezone.utc)

    with (
        patch("agent.routers.sdk.settings.sdk_client_token_rate_limit_per_minute", 1),
        patch("agent.routers.sdk.issue_sdk_client_token", return_value=("sdk-token", expires_at)),
    ):
        await create_sdk_client_token(request=request, response=response, app=app)
        with pytest.raises(HTTPException) as exc_info:
            await create_sdk_client_token(request=request, response=response, app=app)

    assert exc_info.value.status_code == 429
