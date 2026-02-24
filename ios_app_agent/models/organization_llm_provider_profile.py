import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ios_app_agent.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from ios_app_agent.models.agent_config import AgentConfig
    from ios_app_agent.models.organization import Organization


class OrganizationLLMProviderProfile(Base, UUIDMixin):
    __tablename__ = "organization_llm_provider_profiles"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_org_llm_profile_name"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120))
    provider: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(128))
    api_key_encrypted: Mapped[str] = mapped_column(Text)
    api_base: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    organization: Mapped["Organization"] = relationship(back_populates="llm_provider_profiles")
    agent_configs: Mapped[list["AgentConfig"]] = relationship(back_populates="llm_profile")
