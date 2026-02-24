import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.routers.organizations import create_llm_profile
from ios_app_agent.schemas.provider_profiles import OrganizationLLMProfileCreate


def _owner(org_id: uuid.UUID) -> DeveloperAccount:
    return DeveloperAccount(
        email="owner@example.com",
        name="Owner",
        hashed_password="hash",
        organization_id=org_id,
        role="owner",
    )


class _DummyDB:
    def __init__(self):
        self.added = []
        self.commit = AsyncMock()

    def add(self, obj):  # noqa: ANN001
        self.added.append(obj)

    async def refresh(self, profile):  # noqa: ANN001
        profile.id = uuid.uuid4()
        profile.created_at = datetime.now(timezone.utc)
        profile.updated_at = datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_create_llm_profile_rejects_invalid_provider_key():
    developer = _owner(uuid.uuid4())
    db = AsyncMock()

    with patch(
        "ios_app_agent.routers.organizations.test_provider_connection",
        new_callable=AsyncMock,
    ) as test_mock:
        test_mock.return_value = {"ok": False, "latency_ms": None, "error": "invalid api key"}
        with pytest.raises(HTTPException) as exc_info:
            await create_llm_profile(
                body=OrganizationLLMProfileCreate(
                    name="OpenAI Prod",
                    provider="openai",
                    api_key="bad-key",
                    api_base=None,
                ),
                developer=developer,
                db=db,
            )

    assert exc_info.value.status_code == 400
    assert "invalid api key" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_create_llm_profile_accepts_valid_provider_key():
    developer = _owner(uuid.uuid4())
    db = _DummyDB()

    with patch(
        "ios_app_agent.routers.organizations.test_provider_connection",
        new_callable=AsyncMock,
    ) as test_mock, patch(
        "ios_app_agent.routers.organizations.encrypt",
        return_value="encrypted-key",
    ):
        test_mock.return_value = {"ok": True, "latency_ms": 123, "error": None}
        out = await create_llm_profile(
            body=OrganizationLLMProfileCreate(
                name="OpenAI Prod",
                provider="openai",
                api_key="good-key",
                api_base=None,
            ),
            developer=developer,
            db=db,
        )

    assert out.provider == "openai"
    assert out.name == "OpenAI Prod"
    assert not hasattr(out, "model")


@pytest.mark.asyncio
async def test_create_llm_profile_trims_api_key_before_validation():
    developer = _owner(uuid.uuid4())
    db = _DummyDB()

    with patch(
        "ios_app_agent.routers.organizations.test_provider_connection",
        new_callable=AsyncMock,
    ) as test_mock, patch(
        "ios_app_agent.routers.organizations.encrypt",
        return_value="encrypted-key",
    ):
        test_mock.return_value = {"ok": True, "latency_ms": 123, "error": None}
        await create_llm_profile(
            body=OrganizationLLMProfileCreate(
                name="OpenAI Prod",
                provider="openai",
                api_key="  sk-live  ",
                api_base=None,
            ),
            developer=developer,
            db=db,
        )

    assert test_mock.await_args is not None
    assert test_mock.await_args.args[1] == "sk-live"
