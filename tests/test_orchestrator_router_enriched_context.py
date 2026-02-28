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
        self.errors: list[tuple[str, str, bool]] = []

    async def send_text_delta(self, delta: str, accumulated: str) -> None:
        return None

    async def send_tool_call_request(
        self, call_id: str, function_name: str, arguments: dict, timeout_seconds: int, human_description: str = ""
    ) -> None:
        return None

    async def send_turn_complete(self, full_text: str, usage: dict | None) -> None:
        self.turn_complete_text = full_text
        self.turn_complete_usage = usage

    async def send_error(self, code: str, message: str, recoverable: bool = True) -> None:
        self.errors.append((code, message, recoverable))

    async def wait_for_tool_result(self, call_id: str, timeout: int) -> dict:
        raise AssertionError("Tool round-trip should not be reached in these tests")


def _response_with_final_text(text: str) -> SimpleNamespace:
    message = SimpleNamespace(content=text, tool_calls=[])
    choice = SimpleNamespace(message=message)
    usage = SimpleNamespace(prompt_tokens=10, completion_tokens=4)
    return SimpleNamespace(choices=[choice], usage=usage)


@pytest.mark.asyncio
async def test_run_agent_loop_strict_scope_rejects_and_persists_message(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(id=uuid.uuid4(), app_id=uuid.uuid4())
    config = SimpleNamespace(
        system_prompt="My app helps users manage account settings.",
        scope_mode="strict",
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
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(uuid.uuid4(), [])))
    monkeypatch.setattr(
        orchestrator,
        "_run_router",
        AsyncMock(
            return_value=orchestrator.RouterResult(
                in_scope=False,
                rejection_reason="I can only help with iOS app capabilities.",
                needs_kb=False,
                kb_query=None,
                intent="General trivia question",
            )
        ),
    )
    prefetch_mock = AsyncMock(return_value="")
    monkeypatch.setattr(orchestrator, "_prefetch_kb_context", prefetch_mock)
    playbook_mock = AsyncMock(return_value="")
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", playbook_mock)
    llm_mock = AsyncMock(return_value=_response_with_final_text("Should not be returned"))
    monkeypatch.setattr(orchestrator, "call_llm", llm_mock)

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=[],
        user_text="What's the weather today?",
        sender=sender,
    )

    assert sender.turn_complete_text == "I can only help with iOS app capabilities."
    assert sender.errors == []
    llm_mock.assert_not_awaited()
    prefetch_mock.assert_not_awaited()
    playbook_mock.assert_not_awaited()

    assistant_messages = [msg for msg in db.added if isinstance(msg, Message) and msg.role == "assistant"]
    assert len(assistant_messages) == 1
    assert assistant_messages[0].content == "I can only help with iOS app capabilities."


@pytest.mark.asyncio
async def test_run_agent_loop_strict_scope_uses_generic_rejection_when_router_reason_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(id=uuid.uuid4(), app_id=uuid.uuid4())
    config = SimpleNamespace(
        system_prompt="My app helps users manage account settings.",
        scope_mode="strict",
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
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(uuid.uuid4(), [])))
    monkeypatch.setattr(
        orchestrator,
        "_run_router",
        AsyncMock(
            return_value=orchestrator.RouterResult(
                in_scope=False,
                rejection_reason=None,
                needs_kb=False,
                kb_query=None,
                intent="General trivia question",
            )
        ),
    )
    prefetch_mock = AsyncMock(return_value="")
    monkeypatch.setattr(orchestrator, "_prefetch_kb_context", prefetch_mock)
    playbook_mock = AsyncMock(return_value="")
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", playbook_mock)
    llm_mock = AsyncMock(return_value=_response_with_final_text("Should not be returned"))
    monkeypatch.setattr(orchestrator, "call_llm", llm_mock)

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=[],
        user_text="What's the weather today?",
        sender=sender,
    )

    assert sender.turn_complete_text == "I can only help with questions related to the app you are using."
    assert sender.errors == []
    llm_mock.assert_not_awaited()
    prefetch_mock.assert_not_awaited()
    playbook_mock.assert_not_awaited()

    assistant_messages = [msg for msg in db.added if isinstance(msg, Message) and msg.role == "assistant"]
    assert len(assistant_messages) == 1
    assert assistant_messages[0].content == "I can only help with questions related to the app you are using."


@pytest.mark.asyncio
async def test_run_agent_loop_strict_scope_router_false_negative_direct_url_intent_continues(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(id=uuid.uuid4(), app_id=uuid.uuid4())
    config = SimpleNamespace(
        system_prompt="Scout4Me helps users monitor product URLs and manage tracked links.",
        scope_mode="strict",
        max_tool_rounds=3,
        max_context_messages=20,
    )
    functions = [
        SimpleNamespace(
            name="delete_monitoring_url",
            description="Delete monitored ScoutForMe URLs by URL, domain, or description.",
            description_override=None,
            is_active=True,
            parameters_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                },
            },
        )
    ]

    sequence_counter = {"value": 0}

    async def fake_next_sequence(_db, _session_id):  # noqa: ANN001
        sequence_counter["value"] += 1
        return sequence_counter["value"]

    monkeypatch.setattr(orchestrator, "get_next_sequence", fake_next_sequence)
    monkeypatch.setattr(orchestrator, "update_activity", AsyncMock())
    monkeypatch.setattr(orchestrator, "load_context_messages", AsyncMock(return_value=[]))
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(uuid.uuid4(), [])))
    monkeypatch.setattr(
        orchestrator,
        "_run_router",
        AsyncMock(
            return_value=orchestrator.RouterResult(
                in_scope=False,
                rejection_reason="I can only help with app-related issues.",
                needs_kb=False,
                kb_query=None,
                intent="Delete monitored URL entry",
            )
        ),
    )
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", AsyncMock(return_value=""))
    monkeypatch.setattr(orchestrator, "_prefetch_kb_context", AsyncMock(return_value=""))
    llm_mock = AsyncMock(return_value=_response_with_final_text("Deleted the requested URL from monitoring."))
    monkeypatch.setattr(orchestrator, "call_llm", llm_mock)

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=functions,
        user_text="can you delete navy cap url",
        sender=sender,
    )

    llm_mock.assert_awaited_once()
    assert sender.turn_complete_text == "Deleted the requested URL from monitoring."
    assert sender.errors == []
    assistant_messages = [msg for msg in db.added if isinstance(msg, Message) and msg.role == "assistant"]
    assert len(assistant_messages) == 1
    assert assistant_messages[0].content == "Deleted the requested URL from monitoring."


@pytest.mark.asyncio
async def test_run_agent_loop_strict_scope_router_false_negative_pronoun_followup_continues(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(id=uuid.uuid4(), app_id=uuid.uuid4())
    config = SimpleNamespace(
        system_prompt="Scout4Me helps users monitor product URLs and manage tracked links.",
        scope_mode="strict",
        max_tool_rounds=3,
        max_context_messages=20,
    )
    functions = [
        SimpleNamespace(
            name="delete_monitoring_url",
            description="Delete monitored ScoutForMe URLs by URL, domain, or description.",
            description_override=None,
            is_active=True,
            parameters_schema={"type": "object", "properties": {"url": {"type": "string"}}},
        )
    ]

    sequence_counter = {"value": 0}

    async def fake_next_sequence(_db, _session_id):  # noqa: ANN001
        sequence_counter["value"] += 1
        return sequence_counter["value"]

    monkeypatch.setattr(orchestrator, "get_next_sequence", fake_next_sequence)
    monkeypatch.setattr(orchestrator, "update_activity", AsyncMock())
    monkeypatch.setattr(
        orchestrator,
        "load_context_messages",
        AsyncMock(
            return_value=[
                SimpleNamespace(
                    role="tool_result",
                    content='{"success": true, "count": 4, "urls": [{"description": "Classic Navy Cap", "url": "https://scout4.me/products/1"}]}',
                    tool_calls=None,
                    tool_call_id="call_1",
                ),
                SimpleNamespace(
                    role="assistant",
                    content=(
                        "Currently, the following URLs are being monitored:\n"
                        "1. Classic Navy Cap\n"
                        "2. Oda Bracelet\n"
                        "Let me know if you need any changes made to these URLs."
                    ),
                    tool_calls=None,
                    tool_call_id=None,
                ),
            ]
        ),
    )
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(uuid.uuid4(), [])))
    monkeypatch.setattr(
        orchestrator,
        "_run_router",
        AsyncMock(
            return_value=orchestrator.RouterResult(
                in_scope=False,
                rejection_reason="I can only help with app-related issues.",
                needs_kb=False,
                kb_query=None,
                intent="Delete monitored URL entry",
            )
        ),
    )
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", AsyncMock(return_value=""))
    monkeypatch.setattr(orchestrator, "_prefetch_kb_context", AsyncMock(return_value=""))
    llm_mock = AsyncMock(return_value=_response_with_final_text("Sure. Which URL should I delete?"))
    monkeypatch.setattr(orchestrator, "call_llm", llm_mock)

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=functions,
        user_text="can you delete one of them?",
        sender=sender,
    )

    llm_mock.assert_awaited_once()
    assert sender.turn_complete_text == "Sure. Which URL should I delete?"
    assert sender.errors == []
    assistant_messages = [msg for msg in db.added if isinstance(msg, Message) and msg.role == "assistant"]
    assert len(assistant_messages) == 1
    assert assistant_messages[0].content == "Sure. Which URL should I delete?"


@pytest.mark.asyncio
async def test_run_agent_loop_strict_scope_router_false_negative_url_only_followup_continues(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(id=uuid.uuid4(), app_id=uuid.uuid4())
    config = SimpleNamespace(
        system_prompt="Scout4Me helps users monitor product URLs and manage tracked links.",
        scope_mode="strict",
        max_tool_rounds=3,
        max_context_messages=20,
    )
    functions = [
        SimpleNamespace(
            name="add_monitoring_url",
            description="Add a product URL to monitoring.",
            description_override=None,
            is_active=True,
            parameters_schema={"type": "object", "properties": {"url": {"type": "string"}}},
        )
    ]

    sequence_counter = {"value": 0}

    async def fake_next_sequence(_db, _session_id):  # noqa: ANN001
        sequence_counter["value"] += 1
        return sequence_counter["value"]

    monkeypatch.setattr(orchestrator, "get_next_sequence", fake_next_sequence)
    monkeypatch.setattr(orchestrator, "update_activity", AsyncMock())
    monkeypatch.setattr(
        orchestrator,
        "load_context_messages",
        AsyncMock(
            return_value=[
                SimpleNamespace(
                    role="assistant",
                    content=(
                        "I cannot browse or shop for products directly. "
                        "Please share a specific product URL you want to track in the app."
                    ),
                    tool_calls=None,
                    tool_call_id=None,
                ),
            ]
        ),
    )
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(uuid.uuid4(), [])))
    monkeypatch.setattr(
        orchestrator,
        "_run_router",
        AsyncMock(
            return_value=orchestrator.RouterResult(
                in_scope=False,
                rejection_reason="I can only help with app-related issues.",
                needs_kb=False,
                kb_query=None,
                intent="Share product URL",
            )
        ),
    )
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", AsyncMock(return_value=""))
    monkeypatch.setattr(orchestrator, "_prefetch_kb_context", AsyncMock(return_value=""))
    llm_mock = AsyncMock(return_value=_response_with_final_text("Done. I added that URL to monitoring."))
    monkeypatch.setattr(orchestrator, "call_llm", llm_mock)

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=functions,
        user_text=(
            "https://eavalyne.lt/p/laisvalaikio-batai-nike-air-max-plus-drift-fd4290-010-juoda-0000304826184"
        ),
        sender=sender,
    )

    llm_mock.assert_awaited_once()
    assert sender.turn_complete_text == "Done. I added that URL to monitoring."
    assert sender.errors == []
    assistant_messages = [msg for msg in db.added if isinstance(msg, Message) and msg.role == "assistant"]
    assert len(assistant_messages) == 1
    assert assistant_messages[0].content == "Done. I added that URL to monitoring."


@pytest.mark.asyncio
async def test_run_agent_loop_strict_scope_router_false_negative_brief_contextual_followup_continues(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(id=uuid.uuid4(), app_id=uuid.uuid4())
    config = SimpleNamespace(
        system_prompt="Scout4Me helps users monitor product URLs and manage tracked links.",
        scope_mode="strict",
        max_tool_rounds=3,
        max_context_messages=20,
    )

    sequence_counter = {"value": 0}

    async def fake_next_sequence(_db, _session_id):  # noqa: ANN001
        sequence_counter["value"] += 1
        return sequence_counter["value"]

    monkeypatch.setattr(orchestrator, "get_next_sequence", fake_next_sequence)
    monkeypatch.setattr(orchestrator, "update_activity", AsyncMock())
    monkeypatch.setattr(
        orchestrator,
        "load_context_messages",
        AsyncMock(
            return_value=[
                SimpleNamespace(
                    role="assistant",
                    content="I can add it for you. Should I track it every 10 minutes?",
                    tool_calls=None,
                    tool_call_id=None,
                ),
            ]
        ),
    )
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(uuid.uuid4(), [])))
    monkeypatch.setattr(
        orchestrator,
        "_run_router",
        AsyncMock(
            return_value=orchestrator.RouterResult(
                in_scope=False,
                rejection_reason="I can only help with app-related issues.",
                needs_kb=False,
                kb_query=None,
                intent="Confirm monitoring interval",
            )
        ),
    )
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", AsyncMock(return_value=""))
    monkeypatch.setattr(orchestrator, "_prefetch_kb_context", AsyncMock(return_value=""))
    llm_mock = AsyncMock(return_value=_response_with_final_text("Perfect, I will track it every 10 minutes."))
    monkeypatch.setattr(orchestrator, "call_llm", llm_mock)

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=[],
        user_text="yes, every 10 minutes",
        sender=sender,
    )

    llm_mock.assert_awaited_once()
    assert sender.turn_complete_text == "Perfect, I will track it every 10 minutes."
    assert sender.errors == []
    assistant_messages = [msg for msg in db.added if isinstance(msg, Message) and msg.role == "assistant"]
    assert len(assistant_messages) == 1
    assert assistant_messages[0].content == "Perfect, I will track it every 10 minutes."


@pytest.mark.asyncio
async def test_run_agent_loop_open_mode_continues_and_assembles_enriched_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(
        id=uuid.uuid4(),
        app_id=uuid.uuid4(),
        client_context={
            "platform": "ios",
            "os_name": "iOS",
            "os_version": "18.2",
            "app_version": "1.3.0",
            "sdk_name": "playbook-ios",
            "sdk_version": "1.0.0",
        },
        metadata_={},
        llm_context={
            "location": {"city": "Vilnius", "country": "LT"},
            "network_type": "wifi",
            "is_traveling": False,
        },
    )
    config = SimpleNamespace(
        system_prompt="Our app handles billing and password recovery.",
        scope_mode="open",
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
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(uuid.uuid4(), [uuid.uuid4()])))
    router_mock = AsyncMock(
        return_value=orchestrator.RouterResult(
            in_scope=False,
            rejection_reason="Out of scope",
            needs_kb=True,
            kb_query="reset password steps",
            intent="Password reset help",
        )
    )
    monkeypatch.setattr(
        orchestrator,
        "_run_router",
        router_mock,
    )
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", AsyncMock(return_value="\n\n## Available Playbooks\n### Reset"))
    prefetch_mock = AsyncMock(return_value="\n\n## Relevant Documentation\n### Reset Password\nUse Settings > Account.")
    monkeypatch.setattr(
        orchestrator,
        "_prefetch_kb_context",
        prefetch_mock,
    )
    llm_mock = AsyncMock(return_value=_response_with_final_text("Use Settings > Account > Reset Password."))
    monkeypatch.setattr(orchestrator, "call_llm", llm_mock)

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=[],
        user_text="How do I reset my password?",
        sender=sender,
    )

    assert sender.errors == []
    assert sender.turn_complete_text == "Use Settings > Account > Reset Password."
    llm_mock.assert_awaited_once()
    expected_platform_context = "\n".join(
        [
            "Platform: ios",
            "OS: iOS",
            "OS Version: 18.2",
            "App Version: 1.3.0",
            "SDK: playbook-ios",
            "SDK Version: 1.0.0",
        ]
    )
    assert router_mock.await_args.args[3] == expected_platform_context
    assert "Vilnius" in router_mock.await_args.args[4]
    assert router_mock.await_args.args[5] == []
    assert router_mock.await_args.args[6] == []
    assert prefetch_mock.await_args.kwargs["platform_context"] == expected_platform_context
    assert "location" in prefetch_mock.await_args.kwargs["custom_context"]

    llm_messages = llm_mock.await_args.args[1]
    tools_payload = llm_mock.await_args.args[2]
    system_prompt = llm_messages[0]["content"]

    assert "You are an assistant for a software product." in system_prompt
    assert "customer support assistant" not in system_prompt
    assert "mobile app" not in system_prompt
    assert "## About This Product" in system_prompt
    assert "## Client Platform Context" in system_prompt
    assert "Platform: ios" in system_prompt
    assert "## Session Custom Context" in system_prompt
    assert "network_type" in system_prompt
    assert "## Scope" not in system_prompt
    assert "## Relevant Documentation" in system_prompt
    assert "## Available Playbooks" in system_prompt
    assert any(tool["function"]["name"] == orchestrator.KB_SEARCH_TOOL_NAME for tool in tools_payload)


@pytest.mark.asyncio
async def test_run_agent_loop_forces_kb_prefetch_for_support_contact_question_when_router_misses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _DummyDB()
    sender = _DummySender()
    session = SimpleNamespace(id=uuid.uuid4(), app_id=uuid.uuid4())
    config = SimpleNamespace(
        system_prompt="Our app has subscription and account support features.",
        scope_mode="strict",
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
    monkeypatch.setattr(orchestrator, "_load_kb_assignment_context", AsyncMock(return_value=(uuid.uuid4(), [uuid.uuid4()])))
    monkeypatch.setattr(
        orchestrator,
        "_run_router",
        AsyncMock(
            return_value=orchestrator.RouterResult(
                in_scope=True,
                rejection_reason=None,
                needs_kb=False,
                kb_query=None,
                intent="Ask for support contact",
            )
        ),
    )
    monkeypatch.setattr(orchestrator, "build_playbook_prompt", AsyncMock(return_value=""))
    prefetch_mock = AsyncMock(return_value="\n\n## Relevant Documentation\n### Support\nEmail support@acme.app")
    monkeypatch.setattr(orchestrator, "_prefetch_kb_context", prefetch_mock)
    llm_mock = AsyncMock(return_value=_response_with_final_text("You can contact support at support@acme.app."))
    monkeypatch.setattr(orchestrator, "call_llm", llm_mock)

    await orchestrator.run_agent_loop(
        db=db,
        session=session,
        config=config,
        functions=[],
        user_text="hi what is the support email?",
        sender=sender,
    )

    prefetch_mock.assert_awaited_once()
    assert prefetch_mock.await_args.kwargs["query"] == "hi what is the support email?"
    llm_mock.assert_awaited_once()
    assert sender.turn_complete_text == "You can contact support at support@acme.app."
    assert sender.errors == []


@pytest.mark.asyncio
async def test_prefetch_kb_context_uses_snippet_and_truncates(monkeypatch: pytest.MonkeyPatch) -> None:
    long_snippet = "A" * 1500
    execute_mock = AsyncMock(return_value={"items": [{"source_title": "Password Reset", "snippet": long_snippet}]})
    monkeypatch.setattr(
        orchestrator,
        "execute_internal_kb_tool_call",
        execute_mock,
    )

    result = await orchestrator._prefetch_kb_context(
        session_id=uuid.uuid4(),
        app_org_id=uuid.uuid4(),
        assigned_kb_ids=[uuid.uuid4()],
        query="reset password",
        platform_context="Platform: ios",
        custom_context='{"location":{"city":"Vilnius"}}',
    )

    assert "## Relevant Documentation" in result
    assert "### Password Reset" in result
    assert "A" * 1200 in result
    assert "A" * 1300 not in result
    assert "Client platform context" in execute_mock.await_args.kwargs["arguments"]["query"]
    assert "location" in execute_mock.await_args.kwargs["arguments"]["query"]


@pytest.mark.asyncio
async def test_prefetch_kb_context_removes_urls_and_markdown_links(monkeypatch: pytest.MonkeyPatch) -> None:
    execute_mock = AsyncMock(
        return_value={
            "items": [
                {
                    "title": "Network Troubleshooting",
                    "content": (
                        "See [troubleshooting guide](https://support.example.com/guide) and "
                        "https://support.example.com/linux for Linux details."
                    ),
                }
            ]
        }
    )
    monkeypatch.setattr(orchestrator, "execute_internal_kb_tool_call", execute_mock)

    result = await orchestrator._prefetch_kb_context(
        session_id=uuid.uuid4(),
        app_org_id=uuid.uuid4(),
        assigned_kb_ids=[uuid.uuid4()],
        query="fix slow connection",
    )

    assert "troubleshooting guide" in result
    assert "https://support.example.com/guide" not in result
    assert "https://support.example.com/linux" not in result


def test_assemble_system_prompt_scope_section_only_for_strict() -> None:
    strict_prompt = orchestrator._assemble_system_prompt(
        dev_prompt="This app helps users configure thermostats.",
        scope_mode="strict",
        platform_context="Platform: ios",
        language_context="Locale: en",
        custom_context='{"location":{"city":"Vilnius"}}',
        kb_context="\n\n## Relevant Documentation\n### Thermostat Setup\nStep 1",
        playbook_prompt="\n\n## Available Playbooks\n### Setup",
    )

    assert strict_prompt.startswith(orchestrator.BASE_PROMPT)
    assert "Use available tools when an action, verification, or real-time check is required." in strict_prompt
    assert "Prefer grounded answers from available documentation and playbooks over guessing." in strict_prompt
    assert "## About This Product\nThis app helps users configure thermostats." in strict_prompt
    assert "## Client Platform Context\nPlatform: ios" in strict_prompt
    assert "## Session Custom Context" in strict_prompt
    assert "## Scope" in strict_prompt
    assert "## Relevant Documentation" in strict_prompt
    assert "## Available Playbooks" in strict_prompt

    open_prompt = orchestrator._assemble_system_prompt(
        dev_prompt="This app helps users configure thermostats.",
        scope_mode="open",
        platform_context="",
        language_context="Locale: en",
        custom_context="",
        kb_context="",
        playbook_prompt="",
    )
    assert "## Scope" not in open_prompt


@pytest.mark.asyncio
async def test_run_router_fails_open_when_router_llm_call_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    config = SimpleNamespace(system_prompt="App context", app_id=uuid.uuid4())
    monkeypatch.setattr(orchestrator, "call_llm", AsyncMock(side_effect=RuntimeError("router down")))

    result = await orchestrator._run_router(
        config,
        "How do I reset my password?",
        uuid.uuid4(),
        "Platform: ios",
        '{"location":{"city":"Vilnius"}}',
    )

    assert result.in_scope is True
    assert result.rejection_reason is None
    assert result.needs_kb is True
    assert result.kb_query == "How do I reset my password?"


@pytest.mark.asyncio
async def test_run_router_includes_recent_context_and_functions_in_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    config = SimpleNamespace(system_prompt="App context", app_id=uuid.uuid4())
    captured: dict[str, str] = {}

    async def fake_call_llm(_config, messages, tools=None):  # noqa: ANN001
        captured["prompt"] = messages[1]["content"]
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='{"in_scope":true,"rejection_reason":null,"needs_kb":false,"kb_query":null,"intent":"follow-up"}'))]
        )

    monkeypatch.setattr(orchestrator, "call_llm", fake_call_llm)

    recent_messages = [
        SimpleNamespace(role="assistant", content="Please share the URL you want to track."),
        SimpleNamespace(role="user", content="Can you add Adidas size 44?"),
    ]
    functions = [
        SimpleNamespace(
            name="add_monitoring_url",
            description="Add URL to monitoring list.",
            description_override=None,
            is_active=True,
        )
    ]

    result = await orchestrator._run_router(
        config,
        "https://example.com/product",
        uuid.uuid4(),
        "Platform: ios",
        '{"location":{"city":"Vilnius"}}',
        recent_messages,
        functions,
    )

    assert result.in_scope is True
    prompt = captured["prompt"]
    assert "Recent conversation context:" in prompt
    assert "assistant: Please share the URL you want to track." in prompt
    assert "Available product actions:" in prompt
    assert "- add_monitoring_url: Add URL to monitoring list." in prompt
