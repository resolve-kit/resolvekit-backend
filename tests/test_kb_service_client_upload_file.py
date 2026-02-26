import uuid
from unittest.mock import AsyncMock

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
