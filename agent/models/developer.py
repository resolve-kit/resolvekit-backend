import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from agent.models.app import App
    from agent.models.organization import Organization
    from agent.models.organization_invitation import OrganizationInvitation


class DeveloperAccount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "developer_accounts"
    __table_args__ = (
        CheckConstraint("role IN ('owner','admin','member')", name="ck_developer_accounts_role"),
    )

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member", server_default="member")
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="RESTRICT"), index=True
    )

    organization: Mapped["Organization"] = relationship(back_populates="developers")
    apps: Mapped[list["App"]] = relationship(back_populates="developer", cascade="all, delete-orphan")
    sent_invitations: Mapped[list["OrganizationInvitation"]] = relationship(
        back_populates="inviter", foreign_keys="OrganizationInvitation.inviter_developer_id"
    )
    received_invitations: Mapped[list["OrganizationInvitation"]] = relationship(
        back_populates="invitee", foreign_keys="OrganizationInvitation.invitee_developer_id"
    )
