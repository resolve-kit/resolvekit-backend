import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from agent.models.developer import DeveloperAccount
from agent.models.organization import Organization
from agent.routers.organizations import get_onboarding_state, reset_onboarding_state


def _developer(organization_id: uuid.UUID | None, role: str) -> DeveloperAccount:
    return DeveloperAccount(
        email="dev@example.com",
        name="Dev",
        hashed_password="hash",
        organization_id=organization_id,
        role=role,
    )


@pytest.mark.asyncio
async def test_get_onboarding_state_requires_org_membership() -> None:
    developer = _developer(None, "member")
    db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await get_onboarding_state(developer=developer, db=db)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_reset_onboarding_state_requires_admin_role() -> None:
    developer = _developer(uuid.uuid4(), "member")
    db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await reset_onboarding_state(developer=developer, db=db)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_reset_onboarding_state_returns_latest_state() -> None:
    org_id = uuid.uuid4()
    developer = _developer(org_id, "owner")
    organization = Organization(id=org_id, name="Acme", public_id="acme")
    organization.onboarding_completed_at = datetime.now(timezone.utc)

    db = AsyncMock()
    db.get = AsyncMock(return_value=organization)

    with patch(
        "agent.routers.organizations.resolve_onboarding_state",
        new_callable=AsyncMock,
    ) as resolve_mock:
        resolve_mock.return_value = {
            "organization_id": org_id,
            "is_complete": False,
            "should_show": True,
            "target_app_id": None,
            "target_app_name": None,
            "required_steps": [],
            "optional_tips": [],
        }

        payload = await reset_onboarding_state(developer=developer, db=db)

    assert payload.is_complete is False
    assert payload.should_show is True
    assert organization.onboarding_completed_at is None
    assert organization.onboarding_target_app_id is None
    assert organization.onboarding_reset_count == 1
