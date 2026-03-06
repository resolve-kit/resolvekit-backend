import asyncio
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from starlette.requests import Request

from agent.routers import chat_events
from agent.services.event_stream_service import EventStreamStore


def test_app_uses_event_stream_router_only() -> None:
    text = Path("agent/main.py").read_text(encoding="utf-8")
    assert "chat_events" in text
    assert "chat_ws" not in text
    assert "app.include_router(chat_events.router)" in text


def test_sessions_router_no_longer_exposes_legacy_ticket_transport() -> None:
    text = Path("agent/routers/sessions.py").read_text(encoding="utf-8")
    assert "events_url" in text
    assert "/events" in text
    assert "/ws" not in text


@pytest.mark.asyncio
async def test_event_stream_store_replays_ordered_events_from_cursor() -> None:
    store = EventStreamStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    first = await store.append(
        session_id=session_id,
        app_id=app_id,
        turn_id="turn-1",
        request_id="req-1",
        event_type="assistant_text_delta",
        payload={"delta": "hel", "accumulated": "hel"},
    )
    second = await store.append(
        session_id=session_id,
        app_id=app_id,
        turn_id="turn-1",
        request_id="req-1",
        event_type="assistant_text_delta",
        payload={"delta": "lo", "accumulated": "hello"},
    )

    replay = await store.replay(session_id=session_id, app_id=app_id, after_event_id=first["event_id"])

    assert [item["event_id"] for item in replay] == [second["event_id"]]
    assert replay[0]["payload"]["accumulated"] == "hello"


@pytest.mark.asyncio
async def test_event_stream_store_notifies_waiters_of_new_events() -> None:
    store = EventStreamStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    async def waiter() -> list[dict]:
        return await asyncio.wait_for(
            store.wait_for_events(session_id=session_id, app_id=app_id, after_event_id=None, timeout=1.0),
            timeout=1.0,
        )

    task = asyncio.create_task(waiter())
    await store.append(
        session_id=session_id,
        app_id=app_id,
        turn_id="turn-1",
        request_id="req-1",
        event_type="turn_complete",
        payload={"full_text": "done", "usage": None},
    )
    events = await task

    assert len(events) == 1
    assert events[0]["type"] == "turn_complete"


@pytest.mark.asyncio
async def test_stream_events_yields_initial_keepalive_before_waiting(monkeypatch: pytest.MonkeyPatch) -> None:
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()
    fake_session = SimpleNamespace(id=session_id)
    fake_app = SimpleNamespace(id=app_id)

    async def fake_load_runtime_context(db, passed_session_id, passed_app):
        assert passed_session_id == session_id
        assert passed_app is fake_app
        return fake_session, None, None

    def fake_validate_chat_capability_token(*, token, session_id, app):
        assert session_id == fake_session.id
        assert app is fake_app

    async def should_not_wait_yet(**kwargs):
        raise AssertionError("stream waited for events before yielding initial keepalive")

    monkeypatch.setattr(chat_events, "_load_runtime_context", fake_load_runtime_context)
    monkeypatch.setattr(chat_events, "validate_chat_capability_token", fake_validate_chat_capability_token)
    monkeypatch.setattr(chat_events, "resolve_chat_capability_token", lambda headers: "token")
    monkeypatch.setattr(chat_events.event_stream_store, "wait_for_events", should_not_wait_yet)

    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": f"/v1/sessions/{session_id}/events",
            "headers": [],
        }
    )
    response = await chat_events.stream_events(
        session_id=session_id,
        request=request,
        cursor=None,
        app=fake_app,
        db=object(),
    )

    first_chunk = await response.body_iterator.__anext__()

    assert first_chunk == ": connected\n\n"
