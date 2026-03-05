from pathlib import Path


def test_chat_ws_uses_redis_owner_claim_and_relay_path() -> None:
    text = Path("agent/routers/chat_ws.py").read_text(encoding="utf-8")
    assert "claim_or_get_owner(" in text
    assert "if not is_owner:" in text
    assert "turn_relay_active" in text


def test_chat_ws_owner_disconnect_waits_for_inflight_task() -> None:
    text = Path("agent/routers/chat_ws.py").read_text(encoding="utf-8")
    assert "if turn_state.agent_task is not None and not turn_state.agent_task.done():" in text
    assert "await turn_state.agent_task" in text
    assert "agent_task.cancel()" not in text
