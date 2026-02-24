import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer
from ios_app_agent.models.app import App
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.organization import Organization
from ios_app_agent.models.organization_invitation import OrganizationInvitation
from ios_app_agent.schemas.organization import (
    OrganizationInvitationCreate,
    OrganizationInvitationOut,
    OrganizationMemberOut,
    OrganizationMemberRoleUpdate,
    OrganizationOut,
)
from ios_app_agent.services.authorization_service import (
    ORG_ADMIN_ROLES,
    ORG_ROLE_ADMIN,
    ORG_ROLE_MEMBER,
    ORG_ROLE_OWNER,
    require_org_role,
)
from ios_app_agent.services.organization_service import normalize_email

INVITATION_TTL_DAYS = 7

router = APIRouter(prefix="/v1/organizations", tags=["organizations"])


def _require_org_membership(developer: DeveloperAccount) -> None:
    if developer.organization_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")


def _require_org_admin(developer: DeveloperAccount) -> None:
    require_org_role(developer, ORG_ADMIN_ROLES)


async def _owner_count(db: AsyncSession, organization_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(DeveloperAccount)
        .where(
            DeveloperAccount.organization_id == organization_id,
            DeveloperAccount.role == ORG_ROLE_OWNER,
        )
    )
    return int(result.scalar_one())


@router.get("/me", response_model=OrganizationOut)
async def get_my_organization(
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)

    organization = await db.get(Organization, developer.organization_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return organization


@router.post("/invitations", response_model=OrganizationInvitationOut, status_code=status.HTTP_201_CREATED)
async def invite_member(
    body: OrganizationInvitationCreate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)
    _require_org_admin(developer)

    org_result = await db.execute(select(Organization).where(Organization.id == developer.organization_id))
    organization = org_result.scalar_one_or_none()
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    invitee_email = normalize_email(body.email)
    invitee_result = await db.execute(select(DeveloperAccount).where(DeveloperAccount.email == invitee_email))
    invitee = invitee_result.scalar_one_or_none()
    if not invitee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation target must be a registered user",
        )

    if invitee.id == developer.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot invite yourself")

    if invitee.organization_id == developer.organization_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already in your organization")

    now = datetime.now(timezone.utc)
    pending_result = await db.execute(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == developer.organization_id,
            OrganizationInvitation.invitee_developer_id == invitee.id,
            OrganizationInvitation.status == "pending",
            OrganizationInvitation.expires_at > now,
        )
    )
    if pending_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pending invitation already exists")

    invitation = OrganizationInvitation(
        organization_id=developer.organization_id,
        inviter_developer_id=developer.id,
        invitee_developer_id=invitee.id,
        invitee_email=invitee_email,
        status="pending",
        expires_at=now + timedelta(days=INVITATION_TTL_DAYS),
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return invitation


@router.get("/invitations/received", response_model=list[OrganizationInvitationOut])
async def list_received_invitations(
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(OrganizationInvitation)
        .where(
            OrganizationInvitation.invitee_developer_id == developer.id,
            OrganizationInvitation.status == "pending",
            OrganizationInvitation.expires_at > now,
        )
        .order_by(OrganizationInvitation.created_at.desc())
    )
    return result.scalars().all()


@router.get("/invitations/sent", response_model=list[OrganizationInvitationOut])
async def list_sent_invitations(
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)
    _require_org_admin(developer)

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(OrganizationInvitation)
        .where(
            OrganizationInvitation.organization_id == developer.organization_id,
            OrganizationInvitation.status == "pending",
            OrganizationInvitation.expires_at > now,
        )
        .order_by(OrganizationInvitation.created_at.desc())
    )
    return result.scalars().all()


@router.post("/invitations/{invitation_id}/accept", response_model=OrganizationInvitationOut)
async def accept_invitation(
    invitation_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    invitation = await db.get(OrganizationInvitation, invitation_id)
    if not invitation or invitation.invitee_developer_id != developer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    if invitation.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation is not pending")

    now = datetime.now(timezone.utc)
    if invitation.expires_at <= now:
        invitation.status = "expired"
        await db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation has expired")

    developer.organization_id = invitation.organization_id
    developer.role = ORG_ROLE_MEMBER
    await db.execute(
        update(App)
        .where(App.developer_id == developer.id)
        .values(organization_id=invitation.organization_id)
    )
    invitation.status = "accepted"
    invitation.accepted_at = now

    await db.commit()
    await db.refresh(invitation)
    return invitation


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(
    invitation_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _require_org_membership(developer)

    invitation = await db.get(OrganizationInvitation, invitation_id)
    if not invitation or invitation.organization_id != developer.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    if invitation.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation is not pending")

    can_cancel = developer.id == invitation.inviter_developer_id or developer.role in ORG_ADMIN_ROLES
    if not can_cancel:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient organization permissions")

    invitation.status = "canceled"
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/members", response_model=list[OrganizationMemberOut])
async def list_organization_members(
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)

    result = await db.execute(
        select(DeveloperAccount)
        .where(DeveloperAccount.organization_id == developer.organization_id)
        .order_by(DeveloperAccount.created_at.asc())
    )
    return result.scalars().all()


@router.patch("/members/{member_id}/role", response_model=OrganizationMemberOut)
async def update_member_role(
    member_id: uuid.UUID,
    body: OrganizationMemberRoleUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)
    _require_org_admin(developer)

    target = await db.get(DeveloperAccount, member_id)
    if not target or target.organization_id != developer.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if developer.role == ORG_ROLE_ADMIN and (
        target.role == ORG_ROLE_OWNER or body.role == ORG_ROLE_OWNER
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins cannot modify owner roles",
        )

    if target.role == ORG_ROLE_OWNER and body.role != ORG_ROLE_OWNER:
        owner_count = await _owner_count(db, developer.organization_id)
        if owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one owner must remain in the organization",
            )

    target.role = body.role
    await db.commit()
    await db.refresh(target)
    return target
