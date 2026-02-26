import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from agent.models.developer import DeveloperAccount
    from agent.models.organization import Organization


class OrganizationInvitation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organization_invitations"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
    )
    inviter_developer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("developer_accounts.id", ondelete="CASCADE"),
        index=True,
    )
    invitee_developer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("developer_accounts.id", ondelete="CASCADE"),
        index=True,
    )
    invitee_email: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="invitations")
    inviter: Mapped["DeveloperAccount"] = relationship(
        back_populates="sent_invitations", foreign_keys=[inviter_developer_id]
    )
    invitee: Mapped["DeveloperAccount"] = relationship(
        back_populates="received_invitations", foreign_keys=[invitee_developer_id]
    )
