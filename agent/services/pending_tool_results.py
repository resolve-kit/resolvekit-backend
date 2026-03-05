import asyncio
import uuid
from typing import Any


_pending_tool_results: dict[tuple[str, str, str], asyncio.Future] = {}


def _pending_key(session_id: uuid.UUID, app_id: uuid.UUID, call_id: str) -> tuple[str, str, str]:
    return str(session_id), str(app_id), call_id


def register_pending_tool_result(
    session_id: uuid.UUID,
    app_id: uuid.UUID,
    call_id: str,
    fut: asyncio.Future,
) -> None:
    _pending_tool_results[_pending_key(session_id, app_id, call_id)] = fut


def clear_pending_tool_result(session_id: uuid.UUID, app_id: uuid.UUID, call_id: str) -> None:
    _pending_tool_results.pop(_pending_key(session_id, app_id, call_id), None)


def resolve_pending_tool_result(
    session_id: uuid.UUID,
    app_id: uuid.UUID,
    call_id: str,
    result: dict[str, Any],
) -> bool:
    fut = _pending_tool_results.get(_pending_key(session_id, app_id, call_id))
    if not fut:
        return False
    if not fut.done():
        fut.set_result(result)
    return True
