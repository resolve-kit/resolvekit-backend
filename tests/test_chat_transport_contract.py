import asyncio
import uuid
from pathlib import Path

import pytest

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
