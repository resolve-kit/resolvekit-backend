import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from agent.models.developer import DeveloperAccount
from agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
from agent.routers.organizations import (
    get_embedding_models_for_llm_profile,
    get_llm_models_for_profile,
)
from agent.schemas.agent_config import ModelInfo


def _developer(org_id: uuid.UUID) -> DeveloperAccount:
    return DeveloperAccount(
        email="owner@example.com",
        name="Owner",
        hashed_password="hash",
        organization_id=org_id,
        role="owner",
    )


@pytest.mark.asyncio
async def test_get_embedding_models_for_profile_uses_org_profile_runtime():
    org_id = uuid.uuid4()
    profile = OrganizationLLMProviderProfile(
        organization_id=org_id,
        name="OpenAI Production",
        provider="openai",
        model="gpt-4o",
        api_key_encrypted="encrypted",
        api_base="https://api.openai.com/v1",
    )
    profile.id = uuid.uuid4()
    developer = _developer(org_id)
    db = AsyncMock()
    db.get = AsyncMock(return_value=profile)

    with (
        patch("agent.routers.organizations.decrypt", return_value="sk-live"),
        patch(
            "agent.routers.organizations.list_embedding_models_for_provider",
            new_callable=AsyncMock,
        ) as list_mock,
    ):
        list_mock.return_value = (
            [ModelInfo(id="text-embedding-3-small", name="text-embedding-3-small")],
            True,
            None,
        )
        payload = await get_embedding_models_for_llm_profile(
            llm_profile_id=profile.id,
            developer=developer,
            db=db,
        )

    assert payload.llm_profile_id == profile.id
    assert payload.provider == "openai"
    assert [model.id for model in payload.models] == ["text-embedding-3-small"]
    assert payload.is_dynamic is True
    assert payload.error is None


@pytest.mark.asyncio
async def test_get_embedding_models_for_profile_rejects_other_org_profile():
    org_id = uuid.uuid4()
    profile = OrganizationLLMProviderProfile(
        organization_id=uuid.uuid4(),
        name="Foreign",
        provider="openai",
        model="gpt-4o",
        api_key_encrypted="encrypted",
        api_base=None,
    )
    profile.id = uuid.uuid4()
    developer = _developer(org_id)
    db = AsyncMock()
    db.get = AsyncMock(return_value=profile)

    with pytest.raises(HTTPException) as exc_info:
        await get_embedding_models_for_llm_profile(
            llm_profile_id=profile.id,
            developer=developer,
            db=db,
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_llm_models_for_profile_uses_org_profile_runtime():
    org_id = uuid.uuid4()
    profile = OrganizationLLMProviderProfile(
        organization_id=org_id,
        name="OpenAI Production",
        provider="openai",
        model="default",
        api_key_encrypted="encrypted",
        api_base="https://api.openai.com/v1",
    )
    profile.id = uuid.uuid4()
    developer = _developer(org_id)
    db = AsyncMock()
    db.get = AsyncMock(return_value=profile)

    with (
        patch("agent.routers.organizations.decrypt", return_value="sk-live"),
        patch(
            "agent.routers.organizations.list_models_for_provider",
            new_callable=AsyncMock,
        ) as list_mock,
    ):
        list_mock.return_value = (
            [ModelInfo(id="gpt-4o", name="gpt-4o")],
            True,
            None,
        )
        payload = await get_llm_models_for_profile(
            llm_profile_id=profile.id,
            developer=developer,
            db=db,
        )

    assert payload.llm_profile_id == profile.id
    assert payload.provider == "openai"
    assert [model.id for model in payload.models] == ["gpt-4o"]
    assert payload.is_dynamic is True
    assert payload.error is None
