import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_app_from_api_key, get_current_developer, require_app_ownership
from ios_app_agent.models.app import App
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.message import Message
from ios_app_agent.models.session import ChatSession
from ios_app_agent.schemas.session import MessageOut, SessionCreate, SessionOut

# SDK endpoints (API key auth)
sdk_router = APIRouter(prefix="/v1/sessions", tags=["sessions-sdk"])

# Dashboard endpoints (JWT auth)
dashboard_router = APIRouter(prefix="/v1/apps/{app_id}/sessions", tags=["sessions-dashboard"])


@sdk_router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    app: App = Depends(get_app_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(
        app_id=app.id,
        device_id=body.device_id,
        metadata_=body.metadata,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return SessionOut(
        id=session.id,
        app_id=session.app_id,
        device_id=session.device_id,
        status=session.status,
        last_activity_at=session.last_activity_at,
        created_at=session.created_at,
        ws_url=f"/v1/sessions/{session.id}/ws",
    )


# Dashboard: list sessions for an app
@dashboard_router.get("", response_model=list[SessionOut])
async def list_sessions(
    app_id: uuid.UUID,
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    query = select(ChatSession).where(ChatSession.app_id == app_id)
    if status_filter:
        query = query.where(ChatSession.status == status_filter)
    query = query.order_by(ChatSession.last_activity_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@dashboard_router.get("/{session_id}/messages", response_model=list[MessageOut])
async def get_session_messages(
    app_id: uuid.UUID,
    session_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    session = await db.get(ChatSession, session_id)
    if not session or session.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    result = await db.execute(
        select(Message).where(Message.session_id == session_id).order_by(Message.sequence_number)
    )
    return result.scalars().all()
