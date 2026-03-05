import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from agent.config import settings
from agent.models.agent_config import AgentConfig
from agent.models.message import Message
from agent.models.session import ChatSession

DEFAULT_SESSION_TTL_MINUTES = settings.session_ttl_minutes


async def get_next_sequence(db: AsyncSession, session_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(Message.sequence_number), 0)).where(Message.session_id == session_id)
    )
    return result.scalar_one() + 1


async def load_context_messages(db: AsyncSession, session_id: uuid.UUID, max_messages: int) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.sequence_number.desc())
        .limit(max_messages)
    )
    messages = list(result.scalars().all())
    messages.reverse()
    return messages


async def update_activity(db: AsyncSession, session_id: uuid.UUID) -> None:
    await db.execute(
        update(ChatSession)
        .where(ChatSession.id == session_id)
        .values(last_activity_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def is_session_expired(db: AsyncSession, session: ChatSession, ttl_minutes: int) -> bool:
    if session.status != "active":
        return True
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)
    return session.last_activity_at.replace(tzinfo=timezone.utc) < cutoff


async def resolve_session_ttl_minutes(db: AsyncSession, app_id: uuid.UUID) -> int:
    result = await db.execute(select(AgentConfig.session_ttl_minutes).where(AgentConfig.app_id == app_id))
    ttl_minutes = result.scalar_one_or_none()
    if isinstance(ttl_minutes, int) and ttl_minutes > 0:
        return ttl_minutes
    return DEFAULT_SESSION_TTL_MINUTES


async def get_reusable_session(
    db: AsyncSession,
    *,
    app_id: uuid.UUID,
    device_id: str | None,
    ttl_minutes: int,
) -> ChatSession | None:
    if not device_id:
        return None

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)
    result = await db.execute(
        select(ChatSession)
        .where(
            ChatSession.app_id == app_id,
            ChatSession.device_id == device_id,
            ChatSession.status == "active",
            ChatSession.last_activity_at >= cutoff,
        )
        .order_by(ChatSession.last_activity_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def expire_stale_sessions(db: AsyncSession) -> int:
    # Expire sessions using each app's configured TTL via a JOIN with agent_configs.
    # Sessions for apps without an agent_config fall back to the system default TTL.
    result = await db.execute(
        update(ChatSession)
        .where(
            ChatSession.app_id == AgentConfig.app_id,
            ChatSession.status == "active",
            ChatSession.last_activity_at < func.now() - AgentConfig.session_ttl_minutes * text("interval '1 minute'"),
        )
        .values(status="expired")
    )
    await db.commit()
    return result.rowcount
