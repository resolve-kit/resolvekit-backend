import hashlib
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from agent.middleware.auth import get_app_from_sdk_auth
from agent.services.sdk_client_token_service import issue_sdk_client_token


class _FakeResult:
    def __init__(self, value: object | None) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object | None:
        return self._value


@pytest.mark.asyncio
async def test_get_app_from_sdk_auth_accepts_api_key() -> None:
    app_id = uuid.uuid4()
    raw_api_key = "iaa_test_key"
    api_key = SimpleNamespace(app_id=app_id)
    app = SimpleNamespace(id=app_id, integration_version=1)

    db = SimpleNamespace(
        execute=AsyncMock(return_value=_FakeResult(api_key)),
        get=AsyncMock(return_value=app),
    )
    request = SimpleNamespace(headers={"Authorization": f"Bearer {raw_api_key}"})

    resolved = await get_app_from_sdk_auth(request=request, db=db)

    assert resolved is app
    key_hash = hashlib.sha256(raw_api_key.encode()).hexdigest()
    params = db.execute.await_args.args[0].compile().params
    assert params.get("key_hash_1") == key_hash


@pytest.mark.asyncio
async def test_get_app_from_sdk_auth_accepts_sdk_client_token() -> None:
    app_id = uuid.uuid4()
    app = SimpleNamespace(id=app_id, integration_version=1)
    token, _ = issue_sdk_client_token(app, ttl_seconds=120)

    db = SimpleNamespace(
        execute=AsyncMock(return_value=_FakeResult(None)),
        get=AsyncMock(return_value=app),
    )
    request = SimpleNamespace(headers={"Authorization": f"Bearer {token}"})

    resolved = await get_app_from_sdk_auth(request=request, db=db)

    assert resolved is app
    assert db.get.await_args.args[1] == app_id


@pytest.mark.asyncio
async def test_get_app_from_sdk_auth_rejects_invalid_credentials() -> None:
    db = SimpleNamespace(
        execute=AsyncMock(return_value=_FakeResult(None)),
        get=AsyncMock(return_value=None),
    )
    request = SimpleNamespace(headers={"Authorization": "Bearer invalid-token"})

    with pytest.raises(HTTPException) as exc_info:
        await get_app_from_sdk_auth(request=request, db=db)

    assert exc_info.value.status_code == 401
