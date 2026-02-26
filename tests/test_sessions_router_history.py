import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from agent.routers.sessions import get_session_messages_sdk


class _FakeResult:
    def __init__(self, items: list[object]) -> None:
        self._items = items

    def scalars(self) -> "_FakeResult":
        return self

    def all(self) -> list[object]:
        return self._items


class _FakeDB:
    def __init__(self, session_obj: object | None, messages: list[object]) -> None:
        self._session = session_obj
        self._messages = messages

    async def get(self, _model: object, _session_id: uuid.UUID) -> object | None:
        return self._session

    async def execute(self, _query: object) -> _FakeResult:
        return _FakeResult(self._messages)


@pytest.mark.asyncio
async def test_sdk_session_history_returns_messages_for_owned_session() -> None:
    app_id = uuid.uuid4()
    session_id = uuid.uuid4()
    app = SimpleNamespace(id=app_id, integration_enabled=True, integration_version=1)
    session_obj = SimpleNamespace(id=session_id, app_id=app_id)
    messages = [
        SimpleNamespace(
            id=uuid.uuid4(),
            session_id=session_id,
            sequence_number=1,
            role="user",
            content="hi",
            tool_calls=None,
            tool_call_id=None,
            token_count=None,
            created_at=datetime.now(timezone.utc),
        ),
        SimpleNamespace(
            id=uuid.uuid4(),
            session_id=session_id,
            sequence_number=2,
            role="assistant",
            content="hello",
            tool_calls=None,
            tool_call_id=None,
            token_count=None,
            created_at=datetime.now(timezone.utc),
        ),
    ]
    db = _FakeDB(session_obj=session_obj, messages=messages)
    request = SimpleNamespace(headers={"X-Playbook-Chat-Capability": "cap-token"})

    with patch("agent.routers.sessions.validate_chat_capability_token"):
        out = await get_session_messages_sdk(session_id=session_id, request=request, app=app, db=db)

    assert len(out) == 2
    assert out[0].content == "hi"
    assert out[1].content == "hello"


@pytest.mark.asyncio
async def test_sdk_session_history_rejects_foreign_session() -> None:
    app = SimpleNamespace(id=uuid.uuid4(), integration_enabled=True, integration_version=1)
    foreign_session = SimpleNamespace(id=uuid.uuid4(), app_id=uuid.uuid4())
    db = _FakeDB(session_obj=foreign_session, messages=[])
    request = SimpleNamespace(headers={"X-Playbook-Chat-Capability": "cap-token"})

    with patch("agent.routers.sessions.validate_chat_capability_token"):
        with pytest.raises(HTTPException) as exc_info:
            await get_session_messages_sdk(session_id=foreign_session.id, request=request, app=app, db=db)

    assert exc_info.value.status_code == 404
