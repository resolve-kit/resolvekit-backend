import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ios_app_agent.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from ios_app_agent.models.app import App


class DeveloperAccount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "developer_accounts"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))

    apps: Mapped[list["App"]] = relationship(back_populates="developer", cascade="all, delete-orphan")
