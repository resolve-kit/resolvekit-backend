import uuid
from unittest.mock import AsyncMock

import pytest

from ios_app_agent.services.kb_service_client import KBServiceError
from ios_app_agent.services.orchestrator import execute_internal_kb_tool_call


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_requires_query() -> None:
    payload = await execute_internal_kb_tool_call(
        session_id=uuid.uuid4(),
        app_org_id=uuid.uuid4(),
        assigned_kb_ids=[uuid.uuid4()],
        arguments={},
    )

    assert payload == {"error": "query is required"}


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_requires_assigned_kbs() -> None:
    payload = await execute_internal_kb_tool_call(
        session_id=uuid.uuid4(),
        app_org_id=None,
        assigned_kb_ids=[],
        arguments={"query": "reset password"},
    )

    assert payload == {"error": "No knowledge bases are assigned to this app"}


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_searches_assigned_kbs(monkeypatch: pytest.MonkeyPatch) -> None:
    search_mock = AsyncMock(return_value={"items": [{"title": "Reset Password", "snippet": "Open settings"}]})
    monkeypatch.setattr("ios_app_agent.services.orchestrator.search_multiple_knowledge_bases", search_mock)

    session_id = uuid.uuid4()
    org_id = uuid.uuid4()
    kb_ids = [uuid.uuid4(), uuid.uuid4()]
    payload = await execute_internal_kb_tool_call(
        session_id=session_id,
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
    )


@pytest.mark.asyncio
async def test_execute_internal_kb_tool_call_surfaces_search_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    search_mock = AsyncMock(side_effect=KBServiceError(status_code=503, detail="KB service unavailable"))
    monkeypatch.setattr("ios_app_agent.services.orchestrator.search_multiple_knowledge_bases", search_mock)

    payload = await execute_internal_kb_tool_call(
        session_id=uuid.uuid4(),
        app_org_id=uuid.uuid4(),
        assigned_kb_ids=[uuid.uuid4()],
        arguments={"query": "billing"},
    )

    assert payload == {"error": "KB service unavailable"}
