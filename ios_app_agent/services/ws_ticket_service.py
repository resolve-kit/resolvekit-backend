import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.models.app import App
from ios_app_agent.models.session import ChatSession
from ios_app_agent.models.ws_ticket import SessionWSTicket


WS_TICKET_TTL_SECONDS = 60


def _hash_ticket(raw_ticket: str) -> str:
    return hashlib.sha256(raw_ticket.encode()).hexdigest()


async def issue_ws_ticket(
    db: AsyncSession,
    session: ChatSession,
    app: App,
    ttl_seconds: int = WS_TICKET_TTL_SECONDS,
) -> tuple[str, datetime]:
    raw_ticket = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    await db.execute(
        delete(SessionWSTicket).where(
            SessionWSTicket.session_id == session.id,
            SessionWSTicket.app_id == app.id,
            SessionWSTicket.used_at.is_(None),
        )
    )

    ticket = SessionWSTicket(
        session_id=session.id,
        app_id=app.id,
        ticket_hash=_hash_ticket(raw_ticket),
        expires_at=expires_at,
    )
    db.add(ticket)
    await db.commit()
    return raw_ticket, expires_at


async def consume_ws_ticket(
    db: AsyncSession,
    raw_ticket: str,
    session_id: uuid.UUID,
) -> App | None:
    ticket_hash = _hash_ticket(raw_ticket)
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(SessionWSTicket)
        .where(
            SessionWSTicket.ticket_hash == ticket_hash,
            SessionWSTicket.session_id == session_id,
            SessionWSTicket.used_at.is_(None),
            SessionWSTicket.expires_at >= now,
        )
        .values(used_at=now)
        .returning(SessionWSTicket.app_id)
    )
    app_id = result.scalar_one_or_none()
    if app_id is None:
        return None

    app = await db.get(App, app_id)
    if not app:
        return None

    await db.commit()
    return app
