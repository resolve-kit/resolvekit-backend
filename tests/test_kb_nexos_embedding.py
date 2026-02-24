import pytest

from kb_service.services.embedding import EmbeddingRuntimeConfig, embed_texts


class _DummyResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


@pytest.mark.asyncio
async def test_nexos_embedding_calls_gateway_embeddings_endpoint(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, object] = {}

    class _DummyClient:
        def __init__(self, timeout):  # noqa: ANN001
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return None

        async def post(self, url, json, headers):  # noqa: ANN001
            captured["url"] = url
            captured["json"] = json
            captured["headers"] = headers
            return _DummyResponse({"data": [{"embedding": [1.0, 0.0]}]})

    monkeypatch.setattr("kb_service.services.embedding.httpx.AsyncClient", _DummyClient)

    vectors = await embed_texts(
        texts=["hello"],
        runtime=EmbeddingRuntimeConfig(
            provider="nexos",
            model="7f9a2e84-66f4-4e92-a9ea-e338de8e8e03",
            api_key="Bearer test-token",
            api_base="https://api.nexos.ai/v1",
        ),
    )

    assert captured["url"] == "https://api.nexos.ai/v1/embeddings"
    assert captured["json"] == {
        "model": "7f9a2e84-66f4-4e92-a9ea-e338de8e8e03",
        "input": ["hello"],
    }
    headers = captured["headers"]
    assert isinstance(headers, dict)
    assert headers["Authorization"] == "Bearer test-token"
    assert len(vectors) == 1
