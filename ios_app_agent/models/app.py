import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ios_app_agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from ios_app_agent.models.agent_config import AgentConfig
    from ios_app_agent.models.api_key import ApiKey
    from ios_app_agent.models.developer import DeveloperAccount
    from ios_app_agent.models.function_registry import RegisteredFunction
    from ios_app_agent.models.playbook import Playbook
    from ios_app_agent.models.session import ChatSession


class App(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "apps"
    __table_args__ = (UniqueConstraint("developer_id", "name", name="uq_app_developer_name"),)

    developer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("developer_accounts.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    bundle_id: Mapped[str | None] = mapped_column(String(255))

    developer: Mapped["DeveloperAccount"] = relationship(back_populates="apps")
    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="app", cascade="all, delete-orphan")
    agent_config: Mapped["AgentConfig | None"] = relationship(back_populates="app", cascade="all, delete-orphan", uselist=False)
    functions: Mapped[list["RegisteredFunction"]] = relationship(back_populates="app", cascade="all, delete-orphan")
    playbooks: Mapped[list["Playbook"]] = relationship(back_populates="app", cascade="all, delete-orphan")
    sessions: Mapped[list["ChatSession"]] = relationship(back_populates="app", cascade="all, delete-orphan")
