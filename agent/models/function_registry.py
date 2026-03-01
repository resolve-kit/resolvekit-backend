import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from agent.models.app import App


class RegisteredFunction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "registered_functions"
    __table_args__ = (UniqueConstraint("app_id", "name", name="uq_function_app_name"),)

    app_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("apps.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(1000), default="")
    parameters_schema: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description_override: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=30)
    availability: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    required_entitlements: Mapped[list[str]] = mapped_column(JSONB, default=list)
    required_capabilities: Mapped[list[str]] = mapped_column(JSONB, default=list)
    source: Mapped[str] = mapped_column(String(32), default="app_inline")
    pack_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=True)

    app: Mapped["App"] = relationship(back_populates="functions")
