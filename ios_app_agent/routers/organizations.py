import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer
from ios_app_agent.models.app import App
from ios_app_agent.models.agent_config import AgentConfig
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.organization import Organization
from ios_app_agent.models.organization_invitation import OrganizationInvitation
from ios_app_agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
from ios_app_agent.schemas.organization import (
    OrganizationInvitationCreate,
    OrganizationInvitationOut,
    OrganizationMemberOut,
    OrganizationMemberRoleUpdate,
    OrganizationOut,
)
from ios_app_agent.schemas.provider_profiles import (
    OrganizationEmbeddingModelsOut,
    OrganizationLLMProfileCreate,
    OrganizationLlmModelsOut,
    OrganizationLLMProfileOut,
    OrganizationLLMProfileUpdate,
)
from ios_app_agent.services.authorization_service import (
    ORG_ADMIN_ROLES,
    ORG_ROLE_ADMIN,
    ORG_ROLE_MEMBER,
    ORG_ROLE_OWNER,
    require_org_role,
)
from ios_app_agent.services.encryption import decrypt, encrypt
from ios_app_agent.services.organization_service import normalize_email
from ios_app_agent.services.provider_service import (
    list_embedding_models_for_provider,
    list_models_for_provider,
    list_providers,
    test_provider_connection,
)

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


def _profile_to_out(profile: OrganizationLLMProviderProfile) -> OrganizationLLMProfileOut:
    return OrganizationLLMProfileOut(
        id=profile.id,
        organization_id=profile.organization_id,
        name=profile.name,
        provider=profile.provider,
        has_api_key=bool(profile.api_key_encrypted),
        api_base=profile.api_base,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


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


@router.get("/llm/providers")
async def get_llm_provider_catalog(
    developer: DeveloperAccount = Depends(get_current_developer),
):
    _require_org_membership(developer)
    return list_providers()


@router.get("/embedding-models", response_model=OrganizationEmbeddingModelsOut)
async def get_embedding_models_for_llm_profile(
    llm_profile_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)
    profile = await db.get(OrganizationLLMProviderProfile, llm_profile_id)
    if profile is None or profile.organization_id != developer.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM profile not found")

    api_key = decrypt(profile.api_key_encrypted)
    models, is_dynamic, error = await list_embedding_models_for_provider(
        profile.provider,
        api_key=api_key,
        api_base=profile.api_base,
    )
    return OrganizationEmbeddingModelsOut(
        llm_profile_id=profile.id,
        provider=profile.provider,
        models=models,
        is_dynamic=is_dynamic,
        error=error,
    )


@router.get("/llm-models", response_model=OrganizationLlmModelsOut)
async def get_llm_models_for_profile(
    llm_profile_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)
    profile = await db.get(OrganizationLLMProviderProfile, llm_profile_id)
    if profile is None or profile.organization_id != developer.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM profile not found")

    api_key = decrypt(profile.api_key_encrypted)
    models, is_dynamic, error = await list_models_for_provider(
        profile.provider,
        api_key=api_key,
        api_base=profile.api_base,
    )
    return OrganizationLlmModelsOut(
        llm_profile_id=profile.id,
        provider=profile.provider,
        models=models,
        is_dynamic=is_dynamic,
        error=error,
    )


@router.get("/llm-profiles", response_model=list[OrganizationLLMProfileOut])
async def list_llm_profiles(
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)
    result = await db.execute(
        select(OrganizationLLMProviderProfile)
        .where(OrganizationLLMProviderProfile.organization_id == developer.organization_id)
        .order_by(OrganizationLLMProviderProfile.created_at.asc())
    )
    return [_profile_to_out(profile) for profile in result.scalars().all()]


@router.post("/llm-profiles", response_model=OrganizationLLMProfileOut, status_code=status.HTTP_201_CREATED)
async def create_llm_profile(
    body: OrganizationLLMProfileCreate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)
    _require_org_admin(developer)

    provider = body.provider.strip().lower()
    api_key = body.api_key.strip()
    if not api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="API key required")
    api_base = body.api_base.strip() if body.api_base else None
    connection_check = await test_provider_connection(provider, api_key, api_base)
    if not connection_check["ok"]:
        error_text = connection_check["error"] if isinstance(connection_check.get("error"), str) else "Invalid provider API key"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_text)

    profile = OrganizationLLMProviderProfile(
        organization_id=developer.organization_id,
        name=body.name.strip(),
        provider=provider,
        model="default",
        api_key_encrypted=encrypt(api_key),
        api_base=api_base,
    )
    db.add(profile)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="LLM profile name already exists")
    await db.refresh(profile)
    return _profile_to_out(profile)


@router.patch("/llm-profiles/{profile_id}", response_model=OrganizationLLMProfileOut)
async def update_llm_profile(
    profile_id: uuid.UUID,
    body: OrganizationLLMProfileUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    _require_org_membership(developer)
    _require_org_admin(developer)

    profile = await db.get(OrganizationLLMProviderProfile, profile_id)
    if profile is None or profile.organization_id != developer.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM profile not found")

    updates = body.model_dump(exclude_unset=True)
    if "name" in updates and body.name is not None:
        profile.name = body.name.strip()

    next_provider = body.provider.strip().lower() if body.provider is not None else profile.provider
    if "api_base" in updates:
        next_api_base = body.api_base.strip() if body.api_base else None
    else:
        next_api_base = profile.api_base
    if body.api_key is not None:
        next_api_key = body.api_key.strip()
        if not next_api_key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="API key required")
    else:
        next_api_key = decrypt(profile.api_key_encrypted)

    needs_connection_check = (
        "provider" in updates
        or "api_base" in updates
        or "api_key" in updates
    )
    if needs_connection_check:
        connection_check = await test_provider_connection(next_provider, next_api_key, next_api_base)
        if not connection_check["ok"]:
            error_text = (
                connection_check["error"]
                if isinstance(connection_check.get("error"), str)
                else "Invalid provider API key"
            )
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_text)

    profile.provider = next_provider
    profile.api_base = next_api_base
    if body.api_key is not None:
        profile.api_key_encrypted = encrypt(next_api_key)

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="LLM profile name already exists")
    await db.refresh(profile)
    return _profile_to_out(profile)


@router.delete("/llm-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_llm_profile(
    profile_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _require_org_membership(developer)
    _require_org_admin(developer)

    profile = await db.get(OrganizationLLMProviderProfile, profile_id)
    if profile is None or profile.organization_id != developer.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM profile not found")

    in_use_result = await db.execute(
        select(AgentConfig.id).where(AgentConfig.llm_profile_id == profile.id).limit(1)
    )
    if in_use_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile is assigned to one or more apps",
        )

    await db.delete(profile)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
