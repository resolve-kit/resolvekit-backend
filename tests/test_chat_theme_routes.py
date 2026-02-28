from types import SimpleNamespace

import pytest

from agent.routers.sdk import get_chat_theme as get_sdk_chat_theme
from agent.services.chat_theme_service import default_chat_theme


@pytest.mark.asyncio
async def test_sdk_chat_theme_endpoint_returns_theme() -> None:
    app = SimpleNamespace(chat_theme=default_chat_theme())
    response = await get_sdk_chat_theme(app=app)
    assert response.light.titleText == "#111827"
    assert response.dark.titleText == "#E5E7EB"
