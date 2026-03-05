import asyncio
import uuid
from pathlib import Path

import pytest

from agent.routers.chat_ws import WebSocketSender
from agent.services.pending_tool_results import clear_pending_tool_result, resolve_pending_tool_result


class _FakeWebSocket:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)


@pytest.mark.asyncio
async def test_sender_buffers_frames_until_socket_attaches() -> None:
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()
    sender = WebSocketSender(session_id=session_id, app_id=app_id)

    await sender.send_error("temporary", "not connected yet", recoverable=True)

    ws = _FakeWebSocket()
    await sender.attach_ws(ws)  # type: ignore[arg-type]

    assert len(ws.sent) == 1
    assert ws.sent[0]["type"] == "error"
    assert ws.sent[0]["payload"]["code"] == "temporary"


@pytest.mark.asyncio
async def test_sender_pending_tool_result_survives_socket_detach() -> None:
    session_id = uuid.uuid4()
    app_id = uuid.uuid4()
    sender = WebSocketSender(session_id=session_id, app_id=app_id)

    ws = _FakeWebSocket()
    await sender.attach_ws(ws)  # type: ignore[arg-type]

    call_id = "call-1"
    await sender.send_tool_call_request(
        call_id=call_id,
        function_name="set_lights",
        arguments={"room": "bedroom"},
        timeout_seconds=30,
    )
    sender.detach_ws()

    payload = {"call_id": call_id, "status": "success", "result": {"ok": True}}
    try:
        assert resolve_pending_tool_result(session_id, app_id, call_id, payload)
        result = await sender.wait_for_tool_result(call_id, timeout=1)
        assert result == payload
    finally:
        clear_pending_tool_result(session_id, app_id, call_id)


def test_chat_ws_disconnect_handler_does_not_cancel_inflight_agent_task() -> None:
    text = Path("agent/routers/chat_ws.py").read_text(encoding="utf-8")
    assert "except WebSocketDisconnect:" in text
    assert "sender.detach_ws()" in text
    assert "agent_task.cancel()" not in text
