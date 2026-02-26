from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from agent.routers.auth import signup
from agent.schemas.developer import DeveloperSignup


class DummyResult:
    def __init__(self, scalar=None):
        self._scalar = scalar

    def scalar_one_or_none(self):
        return self._scalar


@pytest.mark.asyncio
async def test_signup_join_org_is_rejected_for_invite_only_flow() -> None:
    body = DeveloperSignup(
        email="joiner@example.com",
        name="Joiner",
        password="ValidPass1!",
        signup_intent="join_org",
        join_organization_id="acme-mobile",
    )
    db = AsyncMock()
    db.execute = AsyncMock(return_value=DummyResult(None))

    with pytest.raises(HTTPException) as exc_info:
        await signup(body=body, db=db)

    assert exc_info.value.status_code == 403
    assert "invitation" in str(exc_info.value.detail).lower()
