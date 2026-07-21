from pathlib import Path


def test_orchestrator_registers_and_handles_escalation_tool() -> None:
    text = Path("agent/services/orchestrator.py").read_text(encoding="utf-8")

    assert 'ESCALATE_TOOL_NAME = "escalate_to_human"' in text
    assert "tools.append(_build_escalate_tool())" in text
    assert 'session.status = "escalated"' in text
    assert "session.escalated_at = datetime.now(timezone.utc)" in text
    assert "session.escalation_reason = reason" in text


def test_orchestrator_escalates_on_max_tool_rounds_exceeded() -> None:
    text = Path("agent/services/orchestrator.py").read_text(encoding="utf-8")

    assert "if tool_round >= config.max_tool_rounds:" in text
    assert 'await escalate_session(db, session, sender, "Maximum tool calling rounds exceeded")' in text


def test_event_stream_sender_emits_escalation_and_feedback_events() -> None:
    text = Path("agent/routers/chat_events.py").read_text(encoding="utf-8")

    assert 'await self._push("session_escalated", {"reason": reason})' in text
    assert 'await self._push("feedback_requested", {})' in text
