import uuid

import pytest
from fastapi import HTTPException

from ios_app_agent.middleware.auth import require_app_ownership
from ios_app_agent.models.app import App
from ios_app_agent.models.developer import DeveloperAccount


def _developer(email: str, organization_id: uuid.UUID) -> DeveloperAccount:
    return DeveloperAccount(
        email=email,
        name="Dev",
        hashed_password="hash",
        organization_id=organization_id,
    )


def test_app_access_allowed_for_same_organization() -> None:
    org_id = uuid.uuid4()
    requester = _developer("member@example.com", org_id)
    owner = _developer("owner@example.com", org_id)
    app = App(developer_id=owner.id, organization_id=org_id, name="Shared App", bundle_id=None)

    require_app_ownership(requester, app.id, app)


def test_app_access_denied_for_different_organization() -> None:
    requester = _developer("member@example.com", uuid.uuid4())
    owner_org_id = uuid.uuid4()
    owner = _developer("owner@example.com", owner_org_id)
    app = App(developer_id=owner.id, organization_id=owner_org_id, name="Shared App", bundle_id=None)

    with pytest.raises(HTTPException) as exc_info:
        require_app_ownership(requester, app.id, app)

    assert exc_info.value.status_code == 404
