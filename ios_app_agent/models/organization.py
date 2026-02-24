from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ios_app_agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from ios_app_agent.models.app import App
    from ios_app_agent.models.developer import DeveloperAccount
    from ios_app_agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
    from ios_app_agent.models.organization_invitation import OrganizationInvitation


class Organization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255))
    public_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    developers: Mapped[list["DeveloperAccount"]] = relationship(back_populates="organization")
    apps: Mapped[list["App"]] = relationship(back_populates="organization")
    invitations: Mapped[list["OrganizationInvitation"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    llm_provider_profiles: Mapped[list["OrganizationLLMProviderProfile"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
    )
