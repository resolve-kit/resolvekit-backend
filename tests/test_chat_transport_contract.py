import asyncio
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from starlette.requests import Request

from agent.routers import chat_events
from agent.services.event_stream_service import EventStreamStore
from agent.services.pending_tool_results import (
    register_pending_tool_result,
    resolve_pending_tool_result,
    clear_pending_tool_result,
)
from agent.services.turn_state_service import TurnStateStore


class FakeRedisStream:
    def __init__(self) -> None:
        self._streams: dict[str, list[tuple[str, dict[str, str]]]] = {}
        self._conditions: dict[str, asyncio.Condition] = {}
        self._next_ms = 1

    async def xadd(self, key: str, fields: dict[str, str]) -> str:
        stream = self._streams.setdefault(key, [])
        event_id = f"{self._next_ms}-0"
        self._next_ms += 1
        stream.append((event_id, dict(fields)))
        condition = self._conditions.setdefault(key, asyncio.Condition())
        async with condition:
            condition.notify_all()
        return event_id

    async def expire(self, key: str, ttl_seconds: int) -> bool:
        return True

    async def xrange(self, key: str, min: str = "-", max: str = "+") -> list[tuple[str, dict[str, str]]]:
        stream = self._streams.get(key, [])
        return [
            (event_id, dict(fields))
            for event_id, fields in stream
            if self._matches_min(event_id, min) and self._matches_max(event_id, max)
        ]

    async def xrevrange(self, key: str, max: str = "+", min: str = "-", count: int | None = None) -> list[tuple[str, dict[str, str]]]:
        items = list(reversed(await self.xrange(key=key, min=min, max=max)))
        if count is not None:
            items = items[:count]
        return items

    async def xread(self, streams: dict[str, str], block: int | None = None, count: int | None = None):
        key, after_id = next(iter(streams.items()))
        existing = await self.xrange(key, min=f"({after_id}", max="+")
        if existing:
            return [(key, existing[:count] if count is not None else existing)]

        timeout_seconds = None if block is None else block / 1000
        condition = self._conditions.setdefault(key, asyncio.Condition())
        async with condition:
            await asyncio.wait_for(condition.wait(), timeout=timeout_seconds)

        existing = await self.xrange(key, min=f"({after_id}", max="+")
        if not existing:
            return []
        return [(key, existing[:count] if count is not None else existing)]

    @staticmethod
    def _matches_min(event_id: str, min_bound: str) -> bool:
        if min_bound in {"-", ""}:
            return True
        exclusive = min_bound.startswith("(")
        bound = min_bound[1:] if exclusive else min_bound
        if exclusive:
            return event_id > bound
        return event_id >= bound

    @staticmethod
    def _matches_max(event_id: str, max_bound: str) -> bool:
        if max_bound in {"+", ""}:
            return True
        exclusive = max_bound.startswith("(")
        bound = max_bound[1:] if exclusive else max_bound
        if exclusive:
            return event_id < bound
        return event_id <= bound


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
async def test_event_stream_store_shares_events_across_instances_with_redis_backend() -> None:
    redis = FakeRedisStream()
    producer = EventStreamStore(redis_client_factory=lambda: redis, redis_enabled_override=True)
    consumer = EventStreamStore(redis_client_factory=lambda: redis, redis_enabled_override=True)
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    appended = await producer.append(
        session_id=session_id,
        app_id=app_id,
        turn_id="turn-redis",
        request_id="req-redis",
        event_type="assistant_text_delta",
        payload={"delta": "hi", "accumulated": "hi"},
    )

    replay = await consumer.replay(session_id=session_id, app_id=app_id, after_event_id=None)

    assert [item["event_id"] for item in replay] == [appended["event_id"]]
    assert replay[0]["payload"]["accumulated"] == "hi"


@pytest.mark.asyncio
async def test_event_stream_store_waits_for_new_redis_events_from_another_instance() -> None:
    redis = FakeRedisStream()
    producer = EventStreamStore(redis_client_factory=lambda: redis, redis_enabled_override=True)
    consumer = EventStreamStore(redis_client_factory=lambda: redis, redis_enabled_override=True)
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    async def waiter() -> list[dict]:
        return await consumer.wait_for_events(
            session_id=session_id,
            app_id=app_id,
            after_event_id=None,
            timeout=1.0,
        )

    task = asyncio.create_task(waiter())
    await asyncio.sleep(0)
    await producer.append(
        session_id=session_id,
        app_id=app_id,
        turn_id="turn-redis",
        request_id="req-redis",
        event_type="turn_complete",
        payload={"full_text": "done", "usage": None},
    )
    events = await task

    assert len(events) == 1
    assert events[0]["type"] == "turn_complete"


@pytest.mark.asyncio
async def test_event_stream_store_raises_when_redis_is_required_but_unavailable() -> None:
    store = EventStreamStore(redis_client_factory=lambda: None, redis_enabled_override=True)

    with pytest.raises(RuntimeError, match="Redis-backed event stream is unavailable"):
        await store.append(
            session_id=uuid.uuid4(),
            app_id=uuid.uuid4(),
            turn_id="turn-redis",
            request_id="req-redis",
            event_type="error",
            payload={"code": "transport_error"},
        )


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


@pytest.mark.asyncio
async def test_pending_tool_result_same_process_delivery() -> None:
    """Tool result submitted in same process resolves the local Future."""
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()
    call_id = "call-1"

    fut: asyncio.Future = asyncio.get_event_loop().create_future()
    await register_pending_tool_result(session_id, app_id, call_id, fut)

    payload = {"call_id": call_id, "status": "success", "result": {"answer": 42}}
    resolved = await resolve_pending_tool_result(session_id, app_id, call_id, payload)

    assert resolved is True
    assert fut.done()
    assert fut.result() == payload
    clear_pending_tool_result(session_id, app_id, call_id)


@pytest.mark.asyncio
async def test_pending_tool_result_dedup_via_turn_state_store() -> None:
    """Dedup keys checked via TurnStateStore prevent duplicate tool results."""
    store = TurnStateStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    key = "turn-1:call-1:idem-1"
    first = await store.check_and_add_dedup_key(session_id=session_id, app_id=app_id, key=key)
    second = await store.check_and_add_dedup_key(session_id=session_id, app_id=app_id, key=key)
    different = await store.check_and_add_dedup_key(session_id=session_id, app_id=app_id, key="turn-1:call-2:idem-1")

    assert first is False
    assert second is True
    assert different is False


@pytest.mark.asyncio
async def test_turn_state_idempotent_request_id_returns_same_turn() -> None:
    """Submitting the same request_id returns the original turn_id without conflict."""
    store = TurnStateStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    turn_id_1, is_new_1 = await store.try_start_turn(
        session_id=session_id, app_id=app_id, request_id="req-A", turn_id="turn-A",
    )
    assert is_new_1 is True

    # Clear the active turn so the lock is released
    await store.clear_turn(session_id=session_id, app_id=app_id, turn_id="turn-A")

    # Same request_id returns original turn_id
    turn_id_2, is_new_2 = await store.try_start_turn(
        session_id=session_id, app_id=app_id, request_id="req-A", turn_id="turn-B",
    )
    assert turn_id_2 == "turn-A"
    assert is_new_2 is False
