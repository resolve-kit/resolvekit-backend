import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.models.message import Message
from ios_app_agent.models.session import ChatSession


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


async def expire_stale_sessions(db: AsyncSession, ttl_minutes: int) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)
    result = await db.execute(
        update(ChatSession)
        .where(ChatSession.status == "active", ChatSession.last_activity_at < cutoff)
        .values(status="expired")
    )
    await db.commit()
    return result.rowcount
