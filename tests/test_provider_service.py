import pytest
import httpx

from agent.schemas.agent_config import ModelInfo
from agent.services import provider_service
from agent.services.provider_service import (
    list_embedding_models_for_provider,
    list_providers,
    test_provider_connection,
)


def test_providers_have_custom_base_url_flag():
    providers = list_providers()
    for p in providers:
        assert hasattr(p, "custom_base_url"), f"{p.id} missing custom_base_url"


def test_nexos_has_custom_base_url():
    providers = list_providers()
    nexos = next((p for p in providers if p.id == "nexos"), None)
    assert nexos is not None
    assert nexos.custom_base_url is True


def test_openai_no_custom_base_url():
    providers = list_providers()
    openai = next((p for p in providers if p.id == "openai"), None)
    assert openai is not None
    assert openai.custom_base_url is False


@pytest.mark.asyncio
async def test_embedding_models_fallback_is_available_for_openai():
    models, is_dynamic, error = await list_embedding_models_for_provider("openai")
    assert error is None
    assert is_dynamic is False
    assert any(model.id.startswith("text-embedding-") for model in models)


@pytest.mark.asyncio
async def test_embedding_models_uses_embedding_mode_for_live_fetch(monkeypatch: pytest.MonkeyPatch):
    async def fake_fetch(provider_id: str, api_url: str, api_key: str, mode: str = "chat"):
        assert provider_id == "openai"
        assert api_key == "sk-live"
        assert mode == "embedding"
        return [ModelInfo(id="text-embedding-3-small", name="text-embedding-3-small")]

    monkeypatch.setattr(provider_service, "_fetch_models", fake_fetch)

    models, is_dynamic, error = await list_embedding_models_for_provider("openai", api_key="sk-live")
    assert error is None
    assert is_dynamic is True
    assert [model.id for model in models] == ["text-embedding-3-small"]


@pytest.mark.asyncio
async def test_test_provider_connection_rejects_unsupported_provider():
    result = await test_provider_connection("unknown-provider", "sk-any", None)
    assert result["ok"] is False
    assert isinstance(result["error"], str)
    assert "unsupported provider" in result["error"].lower()


@pytest.mark.asyncio
async def test_nexos_embedding_models_returns_clear_error_when_not_enabled(monkeypatch: pytest.MonkeyPatch):
    async def fake_fetch_nexos_embeddings_models(api_url: str, api_key: str):  # noqa: ANN001
        request = httpx.Request("GET", api_url)
        response = httpx.Response(
            403,
            request=request,
            json={"error": {"code": 110014, "message": "Action is not allowed"}},
        )
        raise httpx.HTTPStatusError("forbidden", request=request, response=response)

    monkeypatch.setattr(provider_service, "_fetch_nexos_embeddings_models", fake_fetch_nexos_embeddings_models)

    models, is_dynamic, error = await list_embedding_models_for_provider("nexos", api_key="Bearer token")
    assert models == []
    assert is_dynamic is False
    assert error == "Nexos embeddings are not enabled for this API key"


@pytest.mark.asyncio
async def test_nexos_embedding_models_uses_embeddings_models_endpoint(monkeypatch: pytest.MonkeyPatch):
    async def fake_fetch_nexos_embeddings_models(api_url: str, api_key: str):  # noqa: ANN001
        assert api_url == "https://api.nexos.ai/v1/embeddings/models"
        assert api_key == "Bearer token"
        return [ModelInfo(id="text-embedding-3-small", name="text-embedding-3-small")]

    monkeypatch.setattr(provider_service, "_fetch_nexos_embeddings_models", fake_fetch_nexos_embeddings_models)

    models, is_dynamic, error = await list_embedding_models_for_provider("nexos", api_key="Bearer token")
    assert [model.id for model in models] == ["text-embedding-3-small"]
    assert is_dynamic is True
    assert error is None
