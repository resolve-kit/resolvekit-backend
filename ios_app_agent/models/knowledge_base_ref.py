import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ios_app_agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from ios_app_agent.models.app_knowledge_base import AppKnowledgeBase
    from ios_app_agent.models.organization import Organization


class KnowledgeBaseRef(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "knowledge_base_refs"
    __table_args__ = (
        UniqueConstraint("organization_id", "external_kb_id", name="uq_kb_refs_org_external"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    external_kb_id: Mapped[str] = mapped_column(String(64), index=True)
    name_cache: Mapped[str] = mapped_column(String(255))

    organization: Mapped["Organization"] = relationship()
    app_assignments: Mapped[list["AppKnowledgeBase"]] = relationship(
        back_populates="knowledge_base_ref",
        cascade="all, delete-orphan",
    )
