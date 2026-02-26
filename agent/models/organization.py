import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from agent.models.app import App
    from agent.models.developer import DeveloperAccount
    from agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
    from agent.models.organization_invitation import OrganizationInvitation


class Organization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255))
    public_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    onboarding_target_app_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    onboarding_reset_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    developers: Mapped[list["DeveloperAccount"]] = relationship(back_populates="organization")
    apps: Mapped[list["App"]] = relationship(back_populates="organization")
    invitations: Mapped[list["OrganizationInvitation"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    llm_provider_profiles: Mapped[list["OrganizationLLMProviderProfile"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
    )
