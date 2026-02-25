import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import UploadFile

from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.routers.knowledge_bases import kb_sources_add_upload_file


@pytest.mark.asyncio
async def test_kb_sources_add_upload_file_forwards_to_kb_service(monkeypatch: pytest.MonkeyPatch) -> None:
    org_id = uuid.uuid4()
    developer = DeveloperAccount(
        email="owner@example.com",
        name="Owner",
        hashed_password="hash",
        organization_id=org_id,
        role="owner",
    )

    kb_id = uuid.uuid4()

    add_mock = AsyncMock(return_value={"source": {"id": "source-id"}, "job": {"id": "job-id"}})
    monkeypatch.setattr("ios_app_agent.routers.knowledge_bases.add_upload_file_source", add_mock)

    upload = UploadFile(filename="faq.txt", file=AsyncMock())
    upload.read = AsyncMock(return_value=b"hello")

    payload = await kb_sources_add_upload_file(
        kb_id=kb_id,
        file=upload,
        title="FAQ",
        developer=developer,
    )

    assert payload["source"]["id"] == "source-id"
    add_mock.assert_awaited_once()
