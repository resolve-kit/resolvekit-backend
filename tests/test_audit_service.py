import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from ios_app_agent.models.audit_event import AuditEvent
from ios_app_agent.services.audit_service import AuditService


@pytest.mark.asyncio
async def test_emit_event_creates_audit_event():
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    app_id = uuid.uuid4()

    await AuditService.emit(
        db=db,
        app_id=app_id,
        actor_email="dev@example.com",
        event_type="config.llm.updated",
        diff={"before": {"provider": "openai"}, "after": {"provider": "anthropic"}},
    )

    db.add.assert_called_once()
    event = db.add.call_args[0][0]
    assert isinstance(event, AuditEvent)
    assert event.app_id == app_id
    assert event.actor_email == "dev@example.com"
    assert event.event_type == "config.llm.updated"
    assert event.diff["before"]["provider"] == "openai"
    db.flush.assert_called_once()
