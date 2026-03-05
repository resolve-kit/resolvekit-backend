import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.database import get_db
from agent.middleware.auth import get_app_from_sdk_auth
from agent.models.app import App
from agent.models.message import Message
from agent.models.session import ChatSession
from agent.schemas.session import (
    MessageOut,
    SessionContextOut,
    SessionContextPatch,
    SessionCreate,
    SessionOut,
    SessionWSTicketOut,
)
from agent.services.chat_localization_service import effective_texts, resolve_locale
from agent.services.chat_access_service import (
    ensure_chat_available_for_app,
    issue_chat_capability_token,
    resolve_chat_capability_token,
    validate_chat_capability_token,
)
from agent.services.session_service import get_next_sequence, get_reusable_session, resolve_session_ttl_minutes
from agent.services.ws_ticket_service import issue_ws_ticket

# SDK endpoints (API key auth)
sdk_router = APIRouter(prefix="/v1/sessions", tags=["sessions-sdk"])


@sdk_router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    app: App = Depends(get_app_from_sdk_auth),
    db: AsyncSession = Depends(get_db),
):
    ensure_chat_available_for_app(app)

    client_context = body.client.model_dump(exclude_none=True) if body.client else {}
    ttl_minutes = await resolve_session_ttl_minutes(db, app.id)
    resolved_locale = resolve_locale(body.locale, body.preferred_locales)
    session = None
    reused_active_session = False
    if body.reuse_active_session:
        session = await get_reusable_session(
            db,
            app_id=app.id,
            device_id=body.device_id,
            ttl_minutes=ttl_minutes,
        )
        reused_active_session = session is not None

    if session:
        session.device_id = body.device_id
        session.client_context = client_context
        session.llm_context = body.llm_context
        session.available_function_names = body.available_function_names
        session.locale = resolved_locale
        session.status = "active"
        session.last_activity_at = datetime.now(timezone.utc)
    else:
        session = ChatSession(
            app_id=app.id,
            device_id=body.device_id,
            client_context=client_context,
            llm_context=body.llm_context,
            available_function_names=body.available_function_names,
            locale=resolved_locale,
        )
        db.add(session)

    await db.commit()
    await db.refresh(session)
    texts = effective_texts(app, session.locale)
    if not reused_active_session:
        seq = await get_next_sequence(db, session.id)
        db.add(
            Message(
                session_id=session.id,
                sequence_number=seq,
                role="assistant",
                content=texts["initial_message"],
            )
        )
        await db.commit()
        await db.refresh(session)

    chat_capability_token = issue_chat_capability_token(
        session_id=session.id,
        app=app,
        ttl_seconds=ttl_minutes * 60,
    )

    return SessionOut(
        id=session.id,
        app_id=session.app_id,
        device_id=session.device_id,
        client_context=session.client_context,
        llm_context=session.llm_context,
        available_function_names=session.available_function_names,
        locale=session.locale,
        chat_title=texts["chat_title"],
        message_placeholder=texts["message_placeholder"],
        initial_message=texts["initial_message"],
        status=session.status,
        last_activity_at=session.last_activity_at,
        created_at=session.created_at,
        ws_url=f"/v1/sessions/{session.id}/ws",
        chat_capability_token=chat_capability_token,
        reused_active_session=reused_active_session,
    )


@sdk_router.patch("/{session_id}/context", response_model=SessionContextOut)
async def patch_session_context(
    session_id: uuid.UUID,
    body: SessionContextPatch,
    request: Request,
    app: App = Depends(get_app_from_sdk_auth),
    db: AsyncSession = Depends(get_db),
):
    validate_chat_capability_token(
        token=resolve_chat_capability_token(request.headers),
        session_id=session_id,
        app=app,
    )

    session = await db.get(ChatSession, session_id)
    if not session or session.app_id != app.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if body.client is not None:
        session.client_context = body.client.model_dump(exclude_none=True)
    if body.llm_context is not None:
        session.llm_context = body.llm_context
    session.available_function_names = body.available_function_names

    if isinstance(body.locale, str) and body.locale.strip():
        session.locale = resolve_locale(body.locale, [session.locale])

    session.last_activity_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session


@sdk_router.get("/{session_id}/localization")
async def get_session_localization(
    session_id: uuid.UUID,
    request: Request,
    locale: str | None = Query(default=None),
    app: App = Depends(get_app_from_sdk_auth),
    db: AsyncSession = Depends(get_db),
):
    validate_chat_capability_token(
        token=resolve_chat_capability_token(request.headers),
        session_id=session_id,
        app=app,
    )

    session = await db.get(ChatSession, session_id)
    if not session or session.app_id != app.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    resolved = resolve_locale(locale, [session.locale])
    session.locale = resolved
    await db.commit()
    texts = effective_texts(app, resolved)
    return {
        "locale": resolved,
        "chat_title": texts["chat_title"],
        "message_placeholder": texts["message_placeholder"],
        "initial_message": texts["initial_message"],
    }


@sdk_router.post("/{session_id}/ws-ticket", response_model=SessionWSTicketOut)
async def create_ws_ticket(
    session_id: uuid.UUID,
    request: Request,
    app: App = Depends(get_app_from_sdk_auth),
    db: AsyncSession = Depends(get_db),
):
    validate_chat_capability_token(
        token=resolve_chat_capability_token(request.headers),
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


@sdk_router.get("/{session_id}/messages", response_model=list[MessageOut])
async def get_session_messages_sdk(
    session_id: uuid.UUID,
    request: Request,
    app: App = Depends(get_app_from_sdk_auth),
    db: AsyncSession = Depends(get_db),
):
    validate_chat_capability_token(
        token=resolve_chat_capability_token(request.headers),
        session_id=session_id,
        app=app,
    )

    session = await db.get(ChatSession, session_id)
    if not session or session.app_id != app.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    result = await db.execute(
        select(Message)
        .where(
            Message.session_id == session_id,
            Message.role.not_in(["tool_call", "tool_result"]),
        )
        .order_by(Message.sequence_number)
    )
    return result.scalars().all()
