from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agent.services.llm_service import call_llm


@pytest.mark.asyncio
async def test_call_llm_retries_without_temperature(monkeypatch: pytest.MonkeyPatch) -> None:
    class UnsupportedParamsError(Exception):
        pass

    completion_mock = AsyncMock(
        side_effect=[
            UnsupportedParamsError("gpt-5 models do not support temperature=0"),
            {"choices": [{"message": {"content": "ok"}}]},
        ]
    )
    monkeypatch.setattr("agent.services.llm_compat.litellm.acompletion", completion_mock)

    config = SimpleNamespace(
        llm_api_key_encrypted=None,
        llm_provider="openai",
        llm_model="gpt-5",
        temperature=0,
        max_tokens=256,
        llm_api_base=None,
    )

    response = await call_llm(config, [{"role": "user", "content": "hello"}], tools=None)

    assert response["choices"][0]["message"]["content"] == "ok"
    assert completion_mock.await_count == 2
    assert completion_mock.await_args_list[0].kwargs.get("temperature") == 0
    assert "temperature" not in completion_mock.await_args_list[1].kwargs


@pytest.mark.asyncio
async def test_call_llm_normalizes_google_gemini_provider_and_latest_alias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    completion_mock = AsyncMock(return_value={"choices": [{"message": {"content": "ok"}}]})
    monkeypatch.setattr("agent.services.llm_compat.litellm.acompletion", completion_mock)

    config = SimpleNamespace(
        llm_api_key_encrypted=None,
        llm_provider="google",
        llm_model="gemini-flash-lite-latest",
        temperature=0.2,
        max_tokens=256,
        llm_api_base=None,
    )

    response = await call_llm(config, [{"role": "user", "content": "hello"}], tools=None)

    assert response["choices"][0]["message"]["content"] == "ok"
    assert completion_mock.await_count == 1
    assert completion_mock.await_args.kwargs["model"] == "gemini/gemini-2.0-flash-lite"
