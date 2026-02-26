import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, field_validator


class OrganizationInvitationCreate(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class OrganizationInvitationOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    inviter_developer_id: uuid.UUID
    invitee_developer_id: uuid.UUID
    invitee_email: str
    status: str
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganizationMemberOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganizationOut(BaseModel):
    id: uuid.UUID
    name: str
    public_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganizationMemberRoleUpdate(BaseModel):
    role: Literal["owner", "admin", "member"]


class OrganizationOnboardingStepOut(BaseModel):
    id: str
    title: str
    description: str
    route: str
    is_complete: bool
    is_blocked: bool = False
    blocked_reason: str | None = None


class OrganizationOnboardingTipOut(BaseModel):
    id: str
    title: str
    description: str
    route: str


class OrganizationOnboardingOut(BaseModel):
    organization_id: uuid.UUID
    is_complete: bool
    should_show: bool
    can_reset: bool = False
    target_app_id: uuid.UUID | None
    target_app_name: str | None
    required_steps: list[OrganizationOnboardingStepOut]
    optional_tips: list[OrganizationOnboardingTipOut]
