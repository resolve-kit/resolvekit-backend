import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ios_app_agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from ios_app_agent.models.app import App
    from ios_app_agent.models.function_registry import RegisteredFunction


class PlaybookFunction(Base):
    __tablename__ = "playbook_functions"
    __table_args__ = (
        UniqueConstraint("playbook_id", "function_id", name="uq_playbook_function"),
    )

    playbook_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("playbooks.id", ondelete="CASCADE"), primary_key=True
    )
    function_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("registered_functions.id", ondelete="CASCADE"), primary_key=True
    )
    step_order: Mapped[int] = mapped_column(Integer, default=0)
    step_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    playbook: Mapped["Playbook"] = relationship(back_populates="playbook_functions")
    function: Mapped["RegisteredFunction"] = relationship()


class Playbook(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "playbooks"
    __table_args__ = (UniqueConstraint("app_id", "name", name="uq_playbook_app_name"),)

    app_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("apps.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    instructions: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    app: Mapped["App"] = relationship(back_populates="playbooks")
    playbook_functions: Mapped[list["PlaybookFunction"]] = relationship(
        back_populates="playbook", cascade="all, delete-orphan", order_by="PlaybookFunction.step_order"
    )
