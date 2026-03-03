import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from agent.routers.sessions import create_session
from agent.schemas.session import SessionClientInfo, SessionCreate


class _FakeDB:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commit_count = 0
        self.refreshed: list[object] = []

    def add(self, item: object) -> None:
        self.added.append(item)

    async def commit(self) -> None:
        self.commit_count += 1

    async def refresh(self, item: object) -> None:
        if getattr(item, "id", None) is None:
            setattr(item, "id", uuid.uuid4())
        if getattr(item, "created_at", None) is None:
            setattr(item, "created_at", datetime.now(timezone.utc))
        if getattr(item, "last_activity_at", None) is None:
            setattr(item, "last_activity_at", datetime.now(timezone.utc))
        if getattr(item, "status", None) is None:
            setattr(item, "status", "active")
        self.refreshed.append(item)


@pytest.mark.asyncio
async def test_create_session_reuses_latest_active_session() -> None:
    app = SimpleNamespace(
        id=uuid.uuid4(),
        integration_enabled=True,
        integration_version=1,
    )
    existing = SimpleNamespace(
        id=uuid.uuid4(),
        app_id=app.id,
        device_id="device-1",
        client_context={"platform": "old"},
        llm_context={"location": "old"},
        entitlements=["basic"],
        capabilities=["legacy"],
        status="active",
        last_activity_at=datetime.now(timezone.utc) - timedelta(minutes=8),
        created_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db = _FakeDB()
    body = SessionCreate(
        device_id="device-1",
        client=SessionClientInfo(platform="ios"),
        llm_context={"location": "vilnius"},
        entitlements=["pro"],
        capabilities=["camera"],
        reuse_active_session=True,
    )

    with (
        patch("agent.routers.sessions.resolve_session_ttl_minutes", new=AsyncMock(return_value=60)),
        patch("agent.routers.sessions.get_reusable_session", new=AsyncMock(return_value=existing)),
        patch("agent.routers.sessions.issue_chat_capability_token", return_value="cap-token"),
    ):
        response = await create_session(body=body, app=app, db=db)

    assert response.id == existing.id
    assert response.chat_capability_token == "cap-token"
    assert response.reused_active_session is True
    assert response.locale == "en"
    assert response.chat_title == "Support Chat"
    assert response.message_placeholder == "Message"
    assert response.initial_message == "Hello! How can I help you today?"
    assert existing.client_context == {"platform": "ios"}
    assert existing.llm_context == {"location": "vilnius"}
    assert existing.entitlements == ["pro"]
    assert existing.capabilities == ["camera"]
    assert existing.last_activity_at > datetime.now(timezone.utc) - timedelta(minutes=1)
    assert db.added == []
    assert db.commit_count == 1
    assert db.refreshed == [existing]


@pytest.mark.asyncio
async def test_create_session_creates_new_when_reuse_is_disabled() -> None:
    app = SimpleNamespace(
        id=uuid.uuid4(),
        integration_enabled=True,
        integration_version=1,
    )
    db = _FakeDB()
    body = SessionCreate(
        device_id="device-1",
        client=SessionClientInfo(platform="ios"),
        llm_context={"location": "vilnius"},
        entitlements=["pro"],
        capabilities=["camera"],
        preferred_locales=["fr-FR"],
        reuse_active_session=False,
    )

    with (
        patch("agent.routers.sessions.resolve_session_ttl_minutes", new=AsyncMock(return_value=60)),
        patch("agent.routers.sessions.get_reusable_session", new=AsyncMock(side_effect=AssertionError("should not run"))),
        patch("agent.routers.sessions.get_next_sequence", new=AsyncMock(return_value=1)),
        patch("agent.routers.sessions.issue_chat_capability_token", return_value="cap-token"),
    ):
        response = await create_session(body=body, app=app, db=db)

    assert response.app_id == app.id
    assert response.device_id == "device-1"
    assert response.chat_capability_token == "cap-token"
    assert response.reused_active_session is False
    assert response.locale == "fr"
    assert response.initial_message == "Bonjour ! Comment puis-je vous aider aujourd'hui ?"
    assert len(db.added) == 2
    assert db.commit_count == 2
