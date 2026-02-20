import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ios_app_agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from ios_app_agent.models.app import App
    from ios_app_agent.models.message import Message


class ChatSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "chat_sessions"

    app_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("apps.id", ondelete="CASCADE"))
    device_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, expired, closed
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)
    client_context: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    entitlements: Mapped[list[str]] = mapped_column(JSONB, default=list)
    capabilities: Mapped[list[str]] = mapped_column(JSONB, default=list)

    app: Mapped["App"] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(back_populates="session", cascade="all, delete-orphan", order_by="Message.sequence_number")
