import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ios_app_agent.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from ios_app_agent.models.app import App
    from ios_app_agent.models.knowledge_base_ref import KnowledgeBaseRef


class AppKnowledgeBase(Base, TimestampMixin):
    __tablename__ = "app_knowledge_bases"
    __table_args__ = (
        UniqueConstraint("app_id", "knowledge_base_ref_id", name="uq_app_knowledge_base"),
    )

    app_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("apps.id", ondelete="CASCADE"),
        primary_key=True,
    )
    knowledge_base_ref_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_base_refs.id", ondelete="CASCADE"),
        primary_key=True,
    )

    app: Mapped["App"] = relationship(back_populates="knowledge_base_assignments")
    knowledge_base_ref: Mapped["KnowledgeBaseRef"] = relationship(back_populates="app_assignments")
