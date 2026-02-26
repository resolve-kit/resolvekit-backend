import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from agent.models.app import App
from agent.models.developer import DeveloperAccount
from agent.routers.apps import get_chat_theme as get_app_chat_theme
from agent.routers.apps import update_chat_theme as update_app_chat_theme
from agent.routers.sdk import get_chat_theme as get_sdk_chat_theme
from agent.schemas.chat_theme import ChatThemeUpdate
from agent.services.chat_theme_service import default_chat_theme


class _FakeDB:
    def __init__(self, app: App | None) -> None:
        self.app = app
        self.commit_count = 0

    async def get(self, _model: object, _app_id: uuid.UUID) -> App | None:
        return self.app

    async def commit(self) -> None:
        self.commit_count += 1


def _developer(org_id: uuid.UUID) -> DeveloperAccount:
    return DeveloperAccount(
        email="dev@example.com",
        name="Dev",
        hashed_password="hash",
        organization_id=org_id,
    )


def _app(org_id: uuid.UUID) -> App:
    return App(
        developer_id=uuid.uuid4(),
        organization_id=org_id,
        name="Theme App",
        bundle_id="com.example.theme",
        chat_theme=default_chat_theme(),
    )


@pytest.mark.asyncio
async def test_dashboard_chat_theme_get_and_update() -> None:
    org_id = uuid.uuid4()
    app = _app(org_id)
    db = _FakeDB(app)
    developer = _developer(org_id)

    initial = await get_app_chat_theme(app_id=app.id, developer=developer, db=db)
    assert initial.light.titleText == "#111827"

    updated_theme = default_chat_theme()
    updated_theme["light"]["titleText"] = "#123456"
    updated_theme["dark"]["titleText"] = "#ABCDEF12"

    result = await update_app_chat_theme(
        app_id=app.id,
        body=ChatThemeUpdate.model_validate(updated_theme),
        developer=developer,
        db=db,
    )
    assert result.light.titleText == "#123456"
    assert result.dark.titleText == "#ABCDEF12"
    assert db.commit_count == 1


@pytest.mark.asyncio
async def test_dashboard_chat_theme_requires_app_ownership() -> None:
    owner_org = uuid.uuid4()
    app = _app(owner_org)
    db = _FakeDB(app)
    outsider = _developer(uuid.uuid4())

    with pytest.raises(HTTPException) as exc_info:
        await get_app_chat_theme(app_id=app.id, developer=outsider, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_sdk_chat_theme_endpoint_returns_theme() -> None:
    app = SimpleNamespace(chat_theme=default_chat_theme())
    response = await get_sdk_chat_theme(app=app)
    assert response.light.titleText == "#111827"
    assert response.dark.titleText == "#E5E7EB"
