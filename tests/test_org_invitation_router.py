import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.organization import Organization
from ios_app_agent.models.organization_invitation import OrganizationInvitation
from ios_app_agent.routers.organizations import (
    accept_invitation,
    cancel_invitation,
    get_my_organization,
    invite_member,
    list_sent_invitations,
    update_member_role,
)
from ios_app_agent.schemas.organization import OrganizationInvitationCreate, OrganizationMemberRoleUpdate


class DummyScalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class DummyResult:
    def __init__(self, scalar=None, items=None):
        self._scalar = scalar
        self._items = items or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        return DummyScalars(self._items)


def _developer(
    email: str,
    organization_id: uuid.UUID | None = None,
    *,
    role: str = "member",
) -> DeveloperAccount:
    return DeveloperAccount(
        email=email,
        name="Dev",
        hashed_password="hash",
        organization_id=organization_id,
        role=role,
    )


@pytest.mark.asyncio
async def test_invite_member_requires_registered_email() -> None:
    org_id = uuid.uuid4()
    developer = _developer("owner@example.com", org_id, role="owner")
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            DummyResult(Organization(id=org_id, name="Org", public_id="org-id")),
            DummyResult(None),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        await invite_member(
            body=OrganizationInvitationCreate(email="unknown@example.com"),
            developer=developer,
            db=db,
        )

    assert exc_info.value.status_code == 404
    assert "registered user" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_invite_member_requires_owner_or_admin_role() -> None:
    org_id = uuid.uuid4()
    developer = _developer("member@example.com", org_id, role="member")
    db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await invite_member(
            body=OrganizationInvitationCreate(email="invitee@example.com"),
            developer=developer,
            db=db,
        )

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_accept_invitation_assigns_invitee_to_org() -> None:
    org_id = uuid.uuid4()
    developer = _developer("member@example.com", None, role="owner")
    invitation = OrganizationInvitation(
        organization_id=org_id,
        inviter_developer_id=uuid.uuid4(),
        invitee_developer_id=developer.id,
        invitee_email=developer.email,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    invitation.id = uuid.uuid4()

    db = AsyncMock()
    db.get = AsyncMock(return_value=invitation)
    db.execute = AsyncMock(side_effect=[DummyResult(None)])

    out = await accept_invitation(invitation_id=invitation.id, developer=developer, db=db)

    assert out.status == "accepted"
    assert developer.organization_id == org_id
    assert developer.role == "member"


@pytest.mark.asyncio
async def test_list_sent_invitations_returns_pending_org_invitations() -> None:
    org_id = uuid.uuid4()
    developer = _developer("owner@example.com", org_id, role="owner")
    invitation = OrganizationInvitation(
        organization_id=org_id,
        inviter_developer_id=developer.id,
        invitee_developer_id=uuid.uuid4(),
        invitee_email="invitee@example.com",
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )

    db = AsyncMock()
    db.execute = AsyncMock(return_value=DummyResult(items=[invitation]))

    invitations = await list_sent_invitations(developer=developer, db=db)

    assert len(invitations) == 1
    assert invitations[0].invitee_email == "invitee@example.com"


@pytest.mark.asyncio
async def test_get_my_organization_returns_org_details() -> None:
    org_id = uuid.uuid4()
    developer = _developer("owner@example.com", org_id)
    organization = Organization(id=org_id, name="Acme", public_id="acme")

    db = AsyncMock()
    db.get = AsyncMock(return_value=organization)

    out = await get_my_organization(developer=developer, db=db)

    assert out.id == org_id
    assert out.public_id == "acme"


@pytest.mark.asyncio
async def test_cancel_invitation_allows_org_admin() -> None:
    org_id = uuid.uuid4()
    admin = _developer("admin@example.com", org_id, role="admin")
    invitation = OrganizationInvitation(
        organization_id=org_id,
        inviter_developer_id=uuid.uuid4(),
        invitee_developer_id=uuid.uuid4(),
        invitee_email="invitee@example.com",
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    invitation.id = uuid.uuid4()

    db = AsyncMock()
    db.get = AsyncMock(return_value=invitation)

    await cancel_invitation(invitation_id=invitation.id, developer=admin, db=db)

    assert invitation.status == "canceled"


@pytest.mark.asyncio
async def test_update_member_role_admin_cannot_promote_owner() -> None:
    org_id = uuid.uuid4()
    admin = _developer("admin@example.com", org_id, role="admin")
    target = _developer("member@example.com", org_id, role="member")
    target.id = uuid.uuid4()

    db = AsyncMock()
    db.get = AsyncMock(return_value=target)
    db.execute = AsyncMock(return_value=DummyResult(items=[]))

    with pytest.raises(HTTPException) as exc_info:
        await update_member_role(
            member_id=target.id,
            body=OrganizationMemberRoleUpdate(role="owner"),
            developer=admin,
            db=db,
        )

    assert exc_info.value.status_code == 403
