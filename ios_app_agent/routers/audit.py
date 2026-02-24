import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer, require_app_ownership
from ios_app_agent.models.app import App
from ios_app_agent.models.audit_event import AuditEvent
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.schemas.audit import AuditEventOut, AuditEventsPage

router = APIRouter(prefix="/v1/apps/{app_id}/audit-events", tags=["audit"])


@router.get("", response_model=AuditEventsPage)
async def list_audit_events(
    app_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    query = select(AuditEvent).where(AuditEvent.app_id == app_id)

    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor") from exc
        query = query.where(AuditEvent.created_at < cursor_dt)

    if event_type:
        query = query.where(AuditEvent.event_type == event_type)

    query = query.order_by(AuditEvent.created_at.desc()).limit(limit + 1)
    result = await db.execute(query)
    rows = result.scalars().all()

    has_more = len(rows) > limit
    events = rows[:limit]
    next_cursor = events[-1].created_at.isoformat() if has_more and events else None

    return AuditEventsPage(
        events=[AuditEventOut.model_validate(event) for event in events],
        next_cursor=next_cursor,
    )
