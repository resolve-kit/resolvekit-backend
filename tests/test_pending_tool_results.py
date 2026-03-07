import asyncio
import uuid

import pytest

from agent.services.pending_tool_results import (
    clear_pending_tool_result,
    register_pending_tool_result,
    resolve_pending_tool_result,
)


@pytest.mark.asyncio
async def test_resolve_pending_tool_result_completes_registered_future() -> None:
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()
    call_id = "call-1"
    fut: asyncio.Future = asyncio.get_running_loop().create_future()

    await register_pending_tool_result(session_id, app_id, call_id, fut)
    payload = {"call_id": call_id, "status": "success", "result": {"ok": True}}

    try:
        assert await resolve_pending_tool_result(session_id, app_id, call_id, payload)
        assert await asyncio.wait_for(fut, timeout=0.1) == payload
    finally:
        clear_pending_tool_result(session_id, app_id, call_id)


@pytest.mark.asyncio
async def test_resolve_pending_tool_result_returns_false_for_unknown_call() -> None:
    assert not await resolve_pending_tool_result(
        uuid.uuid4(),
        uuid.uuid4(),
        "missing-call",
        {"call_id": "missing-call", "status": "success"},
    )
