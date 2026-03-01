import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agent.services import orchestrator


class _DummyDB:
    def add(self, obj):  # noqa: ANN001
        _ = obj

    async def commit(self) -> None:
        return None


class _DummySender(orchestrator.MessageSender):
    def __init__(self) -> None:
        self.code: str | None = None
        self.message: str | None = None
        self.recoverable: bool | None = None

    async def send_text_delta(self, delta: str, accumulated: str) -> None:
        return None

    async def send_tool_call_request(
        self, call_id: str, function_name: str, arguments: dict, timeout_seconds: int, human_description: str = "", requires_approval: bool = True
    ) -> None:
        return None

    async def send_turn_complete(self, full_text: str, usage: dict | None) -> None:
        raise AssertionError("turn_complete should not be called when llm call fails")

    async def send_error(self, code: str, message: str, recoverable: bool = True) -> None:
        self.code = code
        self.message = message
        self.recoverable = recoverable

    async def wait_for_tool_result(self, call_id: str, timeout: int) -> dict:
        raise AssertionError("tool result should not be requested when llm call fails")


@pytest.mark.asyncio
async def test_run_agent_loop_maps_provider_failures_to_chat_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(id=uuid.uuid4(), app_id=uuid.uuid4())
    config = SimpleNamespace(
        system_prompt="You are support.",
        max_tool_rounds=3,
        max_context_messages=20,
    )

    sequence_counter = {"value": 0}

    async def fake_next_sequence(_db, _session_id):  # noqa: ANN001
        sequence_counter["value"] += 1
        return sequence_counter["value"]

    monkeypatch.setattr(orchestrator, "get_next_sequence", fake_next_sequence)
    monkeypatch.setattr(orchestrator, "update_activity", AsyncMock())
    monkeypatch.setattr(orchestrator, "load_context_messages", AsyncMock(return_value=[]))
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", AsyncMock(return_value=""))
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(None, [])))
    monkeypatch.setattr(
        orchestrator,
        "call_llm",
        AsyncMock(side_effect=RuntimeError("rate_limit_exceeded")),
    )
    monkeypatch.setattr(orchestrator, "is_chat_unavailable_provider_error", lambda exc: True)

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=[],
        user_text="hello",
        sender=sender,
    )

    assert sender.code == "chat_unavailable"
    assert sender.message == "Chat is unavailable, try again later"
    assert sender.recoverable is True
