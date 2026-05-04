import uuid
from unittest.mock import AsyncMock

import httpx
import pytest

from agent.services import knowledge_bases_client


@pytest.mark.asyncio
async def test_add_upload_file_source_uses_multipart_call(monkeypatch: pytest.MonkeyPatch) -> None:
    org_id = uuid.uuid4()
    kb_id = uuid.uuid4()

    call_mock = AsyncMock(return_value={"source": {"id": "source-id"}, "job": {"id": "job-id"}})
    monkeypatch.setattr(knowledge_bases_client, "_call_internal_multipart", call_mock)

    payload = await knowledge_bases_client.add_upload_file_source(
        org_id=org_id,
        actor_id="dev-1",
        actor_role="owner",
        kb_id=kb_id,
        filename="faq.txt",
        content=b"hello",
        content_type="text/plain",
        title="FAQ",
    )

    assert payload["source"]["id"] == "source-id"
    call_mock.assert_awaited_once()

    kwargs = call_mock.await_args.kwargs
    assert kwargs["data"]["organization_id"] == str(org_id)
    assert kwargs["data"]["kb_id"] == str(kb_id)
    assert kwargs["data"]["title"] == "FAQ"
    file_tuple = kwargs["files"]["file"]
    assert file_tuple[0] == "faq.txt"
    assert file_tuple[1] == b"hello"
    assert file_tuple[2] == "text/plain"


@pytest.mark.asyncio
async def test_search_multiple_knowledge_bases_sends_modality_exclusions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    org_id = uuid.uuid4()
    kb_id = uuid.uuid4()

    call_mock = AsyncMock(return_value={"items": []})
    monkeypatch.setattr(knowledge_bases_client, "_call_internal", call_mock)

    await knowledge_bases_client.search_multiple_knowledge_bases(
        org_id=org_id,
        actor_id="dev-1",
        actor_role="owner",
        kb_ids=[kb_id],
        query="password reset",
        limit=5,
        exclude_modalities=["image_caption"],
    )

    kwargs = call_mock.await_args.kwargs
    payload = kwargs["payload"]
    assert payload["organization_id"] == str(org_id)
    assert payload["kb_ids"] == [str(kb_id)]
    assert payload["exclude_modalities"] == ["image_caption"]


@pytest.mark.asyncio
async def test_get_knowledge_base_briefs_calls_internal_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    org_id = uuid.uuid4()
    kb_id = uuid.uuid4()

    call_mock = AsyncMock(return_value={"items": []})
    monkeypatch.setattr(knowledge_bases_client, "_call_internal", call_mock)

    await knowledge_bases_client.get_knowledge_base_briefs(
        org_id=org_id,
        actor_id="dev-1",
        actor_role="owner",
        kb_ids=[kb_id],
    )

    kwargs = call_mock.await_args.kwargs
    assert kwargs["path"] == "/internal/kbs/briefs"
    payload = kwargs["payload"]
    assert payload["organization_id"] == str(org_id)
    assert payload["kb_ids"] == [str(kb_id)]


def test_get_kb_integration_status_from_config_detects_misconfiguration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(knowledge_bases_client.settings, "knowledge_bases_signing_key", "change-me-kb-service-signing-key")
    status = knowledge_bases_client.get_kb_integration_status_from_config()
    assert status.enabled is False
    assert status.code == "kb_auth_misconfigured"


@pytest.mark.asyncio
async def test_probe_kb_service_health_returns_unavailable_on_http_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(knowledge_bases_client.settings, "knowledge_bases_signing_key", "secure-signing-key")
    monkeypatch.setattr(knowledge_bases_client.settings, "knowledge_bases_base_url", "http://kb-service:8100")
    monkeypatch.setattr(knowledge_bases_client.settings, "knowledge_bases_audience", "kb-service")

    class _BrokenClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, _url: str):
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(knowledge_bases_client.httpx, "AsyncClient", lambda **_kwargs: _BrokenClient())

    status = await knowledge_bases_client.probe_kb_service_health()
    assert status.enabled is False
    assert status.code == "kb_service_unavailable"
