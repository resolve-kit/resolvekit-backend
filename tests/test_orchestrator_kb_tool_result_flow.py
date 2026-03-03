import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agent.models.message import Message
from agent.services import orchestrator


class _DummyDB:
    def __init__(self) -> None:
        self.added: list[Message] = []

    def add(self, obj: Message) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        return None


class _DummySender(orchestrator.MessageSender):
    def __init__(self) -> None:
        self.turn_complete_text: str | None = None
        self.turn_complete_usage: dict | None = None

    async def send_text_delta(self, delta: str, accumulated: str) -> None:
        return None

    async def send_tool_call_request(
        self, call_id: str, function_name: str, arguments: dict, timeout_seconds: int, human_description: str = "", requires_approval: bool = True
    ) -> None:
        return None

    async def send_turn_complete(self, full_text: str, usage: dict | None) -> None:
        self.turn_complete_text = full_text
        self.turn_complete_usage = usage

    async def send_error(self, code: str, message: str, recoverable: bool = True) -> None:
        raise AssertionError(f"Unexpected error sent to client: {code} {message}")

    async def wait_for_tool_result(self, call_id: str, timeout: int) -> dict:
        raise AssertionError("SDK tool roundtrip should not be used for internal KB tool calls")


def _response_with_tool_call() -> SimpleNamespace:
    tool_call = SimpleNamespace(
        id="tc_kb_1",
        function=SimpleNamespace(
            name=orchestrator.KB_SEARCH_TOOL_NAME,
            arguments=json.dumps({"query": "reset password", "top_k": 2}),
        ),
    )
    message = SimpleNamespace(content="", tool_calls=[tool_call])
    choice = SimpleNamespace(message=message)
    usage = SimpleNamespace(prompt_tokens=10, completion_tokens=5)
    return SimpleNamespace(choices=[choice], usage=usage)


def _response_with_final_text() -> SimpleNamespace:
    message = SimpleNamespace(content="Use Settings > Account > Reset Password.", tool_calls=[])
    choice = SimpleNamespace(message=message)
    usage = SimpleNamespace(prompt_tokens=12, completion_tokens=7)
    return SimpleNamespace(choices=[choice], usage=usage)


@pytest.mark.asyncio
async def test_run_agent_loop_persists_internal_kb_tool_result(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(
        id=uuid.uuid4(),
        app_id=uuid.uuid4(),
        client_context={"platform": "ios", "os_name": "iOS", "os_version": "18.2"},
        llm_context={"location": {"city": "Vilnius", "country": "LT"}, "network_type": "wifi"},
    )
    config = SimpleNamespace(
        system_prompt="You are support.",
        max_tool_rounds=3,
        max_context_messages=20,
        kb_vision_mode="ocr_safe",
    )

    org_id = uuid.uuid4()
    kb_id = uuid.uuid4()

    sequence_counter = {"value": 0}

    async def fake_next_sequence(_db, _session_id):  # noqa: ANN001
        sequence_counter["value"] += 1
        return sequence_counter["value"]

    monkeypatch.setattr(orchestrator, "get_next_sequence", fake_next_sequence)
    monkeypatch.setattr(orchestrator, "update_activity", AsyncMock())
    monkeypatch.setattr(orchestrator, "load_context_messages", AsyncMock(return_value=[]))
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", AsyncMock(return_value=""))
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(org_id, [kb_id])))
    monkeypatch.setattr(
        orchestrator,
        "_run_router",
        AsyncMock(
            return_value=orchestrator.RouterResult(
                in_scope=True,
                rejection_reason=None,
                needs_kb=False,
                kb_query=None,
                intent="Password reset",
            )
        ),
    )
    monkeypatch.setattr(
        orchestrator,
        "call_llm",
        AsyncMock(side_effect=[_response_with_tool_call(), _response_with_final_text()]),
    )
    kb_search_mock = AsyncMock(return_value={"items": [{"title": "Reset Password", "snippet": "Open settings"}]})
    monkeypatch.setattr(orchestrator, "search_multiple_knowledge_bases", kb_search_mock)
    monkeypatch.setattr(orchestrator, "generate_tool_descriptions", AsyncMock(return_value=[]))

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=[],
        user_text="How do I reset password?",
        sender=sender,
    )

    kb_search_mock.assert_awaited_once()
    kb_query = kb_search_mock.await_args.kwargs["query"]
    assert kb_query == "reset password"
    assert kb_search_mock.await_args.kwargs["exclude_modalities"] == ["image_caption"]
    assert "Client platform context:" not in kb_query
    assert "Session custom context:" not in kb_query
    tool_results = [msg for msg in db.added if isinstance(msg, Message) and msg.role == "tool_result"]
    assert len(tool_results) == 1
    payload = json.loads(tool_results[0].content or "{}")
    assert payload.get("items")
    assert payload.get("query") == "reset password"
    assert sender.turn_complete_text == "Use Settings > Account > Reset Password."
