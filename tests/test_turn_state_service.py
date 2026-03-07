import asyncio
import uuid

import pytest

from agent.services.turn_state_service import TurnStateStore


@pytest.mark.asyncio
async def test_try_start_turn_returns_new_turn():
    store = TurnStateStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    turn_id, is_new = await store.try_start_turn(
        session_id=session_id,
        app_id=app_id,
        request_id="req-1",
        turn_id="turn-1",
    )

    assert turn_id == "turn-1"
    assert is_new is True


@pytest.mark.asyncio
async def test_try_start_turn_idempotent_on_same_request_id():
    store = TurnStateStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    turn_id_1, is_new_1 = await store.try_start_turn(
        session_id=session_id,
        app_id=app_id,
        request_id="req-1",
        turn_id="turn-1",
    )
    await store.clear_turn(session_id=session_id, app_id=app_id, turn_id="turn-1")

    turn_id_2, is_new_2 = await store.try_start_turn(
        session_id=session_id,
        app_id=app_id,
        request_id="req-1",
        turn_id="turn-2",
    )

    assert turn_id_1 == "turn-1"
    assert is_new_1 is True
    assert turn_id_2 == "turn-1"
    assert is_new_2 is False


@pytest.mark.asyncio
async def test_try_start_turn_rejects_concurrent_turn():
    store = TurnStateStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    await store.try_start_turn(
        session_id=session_id,
        app_id=app_id,
        request_id="req-1",
        turn_id="turn-1",
    )

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await store.try_start_turn(
            session_id=session_id,
            app_id=app_id,
            request_id="req-2",
            turn_id="turn-2",
        )
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_clear_turn_allows_new_turn():
    store = TurnStateStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    await store.try_start_turn(
        session_id=session_id,
        app_id=app_id,
        request_id="req-1",
        turn_id="turn-1",
    )
    await store.clear_turn(session_id=session_id, app_id=app_id, turn_id="turn-1")

    turn_id, is_new = await store.try_start_turn(
        session_id=session_id,
        app_id=app_id,
        request_id="req-2",
        turn_id="turn-2",
    )

    assert turn_id == "turn-2"
    assert is_new is True


@pytest.mark.asyncio
async def test_check_and_add_dedup_key():
    store = TurnStateStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    is_dup_1 = await store.check_and_add_dedup_key(
        session_id=session_id, app_id=app_id, key="turn-1:call-1:idem-1"
    )
    is_dup_2 = await store.check_and_add_dedup_key(
        session_id=session_id, app_id=app_id, key="turn-1:call-1:idem-1"
    )

    assert is_dup_1 is False
    assert is_dup_2 is True


@pytest.mark.asyncio
async def test_has_active_turn():
    store = TurnStateStore()
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()

    assert await store.has_active_turn(session_id=session_id, app_id=app_id) is False

    await store.try_start_turn(
        session_id=session_id,
        app_id=app_id,
        request_id="req-1",
        turn_id="turn-1",
    )
    assert await store.has_active_turn(session_id=session_id, app_id=app_id) is True

    await store.clear_turn(session_id=session_id, app_id=app_id, turn_id="turn-1")
    assert await store.has_active_turn(session_id=session_id, app_id=app_id) is False
