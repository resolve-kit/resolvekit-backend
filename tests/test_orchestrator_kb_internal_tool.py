import uuid
from unittest.mock import ANY, AsyncMock

import pytest

from agent.services.knowledge_bases_client import KBServiceError
from agent.services.orchestrator import execute_internal_kb_tool_call


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_requires_query() -> None:
    payload = await execute_internal_kb_tool_call(
        session_id=uuid.uuid4(),
        app_id=uuid.uuid4(),
        app_org_id=uuid.uuid4(),
        assigned_kb_ids=[uuid.uuid4()],
        arguments={},
    )

    assert payload == {"error": "query is required"}


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_requires_assigned_kbs() -> None:
    payload = await execute_internal_kb_tool_call(
        session_id=uuid.uuid4(),
        app_id=uuid.uuid4(),
        app_org_id=None,
        assigned_kb_ids=[],
        arguments={"query": "reset password"},
    )

    assert payload == {"error": "No knowledge bases are assigned to this app"}


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_searches_assigned_kbs(monkeypatch: pytest.MonkeyPatch) -> None:
    search_mock = AsyncMock(return_value={"items": [{"title": "Reset Password", "snippet": "Open settings"}]})
    monkeypatch.setattr("agent.services.orchestrator.search_multiple_knowledge_bases", search_mock)

    session_id = uuid.uuid4()
    org_id = uuid.uuid4()
    kb_ids = [uuid.uuid4(), uuid.uuid4()]
    payload = await execute_internal_kb_tool_call(
        session_id=session_id,
        app_id=uuid.uuid4(),
        app_org_id=org_id,
        assigned_kb_ids=kb_ids,
        arguments={"query": "how to reset password", "top_k": 3},
    )

    assert payload == {
        "query": "how to reset password",
        "items": [{"title": "Reset Password", "snippet": "Open settings"}],
    }
    search_mock.assert_awaited_once_with(
        org_id=org_id,
        actor_id=f"session:{session_id}",
        actor_role="system",
        kb_ids=kb_ids,
        query="how to reset password",
        limit=3,
        exclude_modalities=["image_caption"],
        app_id=ANY,
        session_id=session_id,
    )


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_multimodal_mode_does_not_exclude_caption(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    search_mock = AsyncMock(return_value={"items": [{"title": "Reset Password", "snippet": "Open settings"}]})
    monkeypatch.setattr("agent.services.orchestrator.search_multiple_knowledge_bases", search_mock)

    session_id = uuid.uuid4()
    org_id = uuid.uuid4()
    kb_ids = [uuid.uuid4()]
    payload = await execute_internal_kb_tool_call(
        session_id=session_id,
        app_id=uuid.uuid4(),
        app_org_id=org_id,
        assigned_kb_ids=kb_ids,
        arguments={"query": "how to reset password", "top_k": 2},
        kb_vision_mode="multimodal",
    )

    assert payload["query"] == "how to reset password"
    search_mock.assert_awaited_once_with(
        org_id=org_id,
        actor_id=f"session:{session_id}",
        actor_role="system",
        kb_ids=kb_ids,
        query="how to reset password",
        limit=2,
        exclude_modalities=[],
        app_id=ANY,
        session_id=session_id,
    )


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_surfaces_search_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    search_mock = AsyncMock(side_effect=KBServiceError(status_code=503, detail="KB service unavailable"))
    monkeypatch.setattr("agent.services.orchestrator.search_multiple_knowledge_bases", search_mock)

    payload = await execute_internal_kb_tool_call(
        session_id=uuid.uuid4(),
        app_id=uuid.uuid4(),
        app_org_id=uuid.uuid4(),
        assigned_kb_ids=[uuid.uuid4()],
        arguments={"query": "billing"},
    )

    assert payload == {"error": "KB service unavailable"}


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_sanitizes_url_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    search_mock = AsyncMock(
        return_value={
            "items": [
                {
                    "title": "Slow Connection",
                    "snippet": (
                        "Read [the guide](https://support.example.com/guide) and "
                        "also visit https://support.example.com/linux."
                    ),
                    "source_url": "https://support.example.com/guide",
                }
            ]
        }
    )
    monkeypatch.setattr("agent.services.orchestrator.search_multiple_knowledge_bases", search_mock)

    payload = await execute_internal_kb_tool_call(
        session_id=uuid.uuid4(),
        app_id=uuid.uuid4(),
        app_org_id=uuid.uuid4(),
        assigned_kb_ids=[uuid.uuid4()],
        arguments={"query": "slow internet"},
    )

    assert payload["query"] == "slow internet"
    assert len(payload["items"]) == 1
    item = payload["items"][0]
    assert item["title"] == "Slow Connection"
    assert item["snippet"] == "Read the guide and also visit"
    assert "source_url" not in item
