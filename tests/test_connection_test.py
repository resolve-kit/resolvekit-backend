from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ios_app_agent.services.provider_service import test_provider_connection


@pytest.mark.asyncio
async def test_connection_returns_ok_true_on_success():
    with patch(
        "ios_app_agent.services.provider_service.list_models_for_provider",
        new=AsyncMock(
            return_value=(
                [MagicMock(id="gpt-4o", name="GPT-4o")],
                True,
                None,
            )
        ),
    ):
        result = await test_provider_connection("openai", "sk-test", None)

    assert result["ok"] is True
    assert result["error"] is None
    assert result["latency_ms"] >= 0


@pytest.mark.asyncio
async def test_connection_returns_ok_false_on_error():
    with patch(
        "ios_app_agent.services.provider_service.list_models_for_provider",
        new=AsyncMock(return_value=([], False, "Invalid API key")),
    ):
        result = await test_provider_connection("openai", "sk-bad", None)

    assert result["ok"] is False
    assert result["error"] == "Invalid API key"


@pytest.mark.asyncio
async def test_connection_requires_api_key():
    result = await test_provider_connection("openai", None, None)
    assert result["ok"] is False
    assert result["error"] == "API key required"


@pytest.mark.asyncio
async def test_connection_requires_live_provider_response():
    with patch(
        "ios_app_agent.services.provider_service.list_models_for_provider",
        new=AsyncMock(
            return_value=([MagicMock(id="gpt-4o", name="GPT-4o")], False, None)
        ),
    ):
        result = await test_provider_connection("openai", "sk-fallback", None)

    assert result["ok"] is False
    assert result["error"] == "Could not verify connection with live provider response"
