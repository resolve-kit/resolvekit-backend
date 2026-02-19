import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ios_app_agent.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from ios_app_agent.models.app import App


class AgentConfig(Base, UUIDMixin):
    __tablename__ = "agent_configs"

    app_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("apps.id", ondelete="CASCADE"), unique=True)
    system_prompt: Mapped[str] = mapped_column(
        Text,
        default=(
            "You are a helpful on-device assistant with access to functions on the user's iOS device. "
            "When the user asks you to do something, call the appropriate functions and use the results "
            "to provide a helpful response.\n\n"
            "Guidelines for multi-step tasks:\n"
            "- Analyze each function result before deciding your next step.\n"
            "- Chain function calls sequentially when later steps depend on earlier results "
            "(e.g., check status first, then act based on what you find).\n"
            "- Explain your reasoning to the user as you work through a problem.\n"
            "- If a function returns an error, acknowledge it and try an alternative approach.\n"
            "- Summarize what you did and the outcome when the task is complete."
        ),
    )
    llm_provider: Mapped[str] = mapped_column(String(50), default="openai")
    llm_model: Mapped[str] = mapped_column(String(100), default="gpt-4o")
    llm_api_key_encrypted: Mapped[str | None] = mapped_column(Text)
    llm_api_base: Mapped[str | None] = mapped_column(String(255), nullable=True)
    temperature: Mapped[float] = mapped_column(default=0.7)
    max_tokens: Mapped[int] = mapped_column(Integer, default=4096)
    max_tool_rounds: Mapped[int] = mapped_column(Integer, default=10)
    session_ttl_minutes: Mapped[int] = mapped_column(Integer, default=60)
    max_context_messages: Mapped[int] = mapped_column(Integer, default=100)

    app: Mapped["App"] = relationship(back_populates="agent_config")
