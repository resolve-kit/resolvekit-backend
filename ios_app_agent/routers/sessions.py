import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_app_from_api_key, get_current_developer, require_app_ownership
from ios_app_agent.models.app import App
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.message import Message
from ios_app_agent.models.session import ChatSession
from ios_app_agent.schemas.session import MessageOut, SessionCreate, SessionOut, SessionWSTicketOut
from ios_app_agent.services.chat_access_service import (
    CHAT_CAPABILITY_HEADER,
    ensure_chat_available_for_app,
    issue_chat_capability_token,
    validate_chat_capability_token,
)
from ios_app_agent.services.ws_ticket_service import issue_ws_ticket

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
    ensure_chat_available_for_app(app)

    session = ChatSession(
        app_id=app.id,
        device_id=body.device_id,
        metadata_=body.metadata,
        client_context=body.client.model_dump(exclude_none=True) if body.client else {},
        llm_context=body.llm_context,
        entitlements=body.entitlements,
        capabilities=body.capabilities,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    chat_capability_token = issue_chat_capability_token(session_id=session.id, app=app)

    return SessionOut(
        id=session.id,
        app_id=session.app_id,
        device_id=session.device_id,
        client_context=session.client_context,
        llm_context=session.llm_context,
        status=session.status,
        last_activity_at=session.last_activity_at,
        created_at=session.created_at,
        ws_url=f"/v1/sessions/{session.id}/ws",
        chat_capability_token=chat_capability_token,
    )


@sdk_router.post("/{session_id}/ws-ticket", response_model=SessionWSTicketOut)
async def create_ws_ticket(
    session_id: uuid.UUID,
    request: Request,
    app: App = Depends(get_app_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    validate_chat_capability_token(
        token=request.headers.get(CHAT_CAPABILITY_HEADER),
        session_id=session_id,
        app=app,
    )

    session = await db.get(ChatSession, session_id)
    if not session or session.app_id != app.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    raw_ticket, expires_at = await issue_ws_ticket(db, session, app)
    return SessionWSTicketOut(
        ws_url=f"/v1/sessions/{session.id}/ws",
        ws_ticket=raw_ticket,
        expires_at=expires_at,
    )


# Dashboard: list sessions for an app
@dashboard_router.get("", response_model=list[SessionOut])
async def list_sessions(
    app_id: uuid.UUID,
    status_filter: str | None = Query(None, alias="status"),
    before: str | None = Query(default=None),
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
    if before:
        cursor = before.replace("Z", "+00:00")
        try:
            before_dt = datetime.fromisoformat(cursor)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid before cursor") from exc
        query = query.where(ChatSession.created_at < before_dt)

    query = query.order_by(ChatSession.created_at.desc()).limit(limit)
    if not before:
        query = query.offset(offset)

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
