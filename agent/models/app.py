import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from agent.models.app_knowledge_base import AppKnowledgeBase
    from agent.models.agent_config import AgentConfig
    from agent.models.api_key import ApiKey
    from agent.models.developer import DeveloperAccount
    from agent.models.function_registry import RegisteredFunction
    from agent.models.organization import Organization
    from agent.models.playbook import Playbook
    from agent.models.session import ChatSession


class App(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "apps"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_app_organization_name"),)

    developer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("developer_accounts.id", ondelete="CASCADE"))
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    bundle_id: Mapped[str | None] = mapped_column(String(255))
    integration_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    integration_version: Mapped[int] = mapped_column(Integer, default=1)

    developer: Mapped["DeveloperAccount"] = relationship(back_populates="apps")
    organization: Mapped["Organization"] = relationship(back_populates="apps")
    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="app", cascade="all, delete-orphan")
    agent_config: Mapped["AgentConfig | None"] = relationship(back_populates="app", cascade="all, delete-orphan", uselist=False)
    functions: Mapped[list["RegisteredFunction"]] = relationship(back_populates="app", cascade="all, delete-orphan")
    playbooks: Mapped[list["Playbook"]] = relationship(back_populates="app", cascade="all, delete-orphan")
    sessions: Mapped[list["ChatSession"]] = relationship(back_populates="app", cascade="all, delete-orphan")
    knowledge_base_assignments: Mapped[list["AppKnowledgeBase"]] = relationship(
        back_populates="app",
        cascade="all, delete-orphan",
    )
