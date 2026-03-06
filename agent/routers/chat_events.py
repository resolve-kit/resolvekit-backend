import asyncio
import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.database import async_session_factory, get_db
from agent.middleware.auth import get_app_from_sdk_auth
from agent.models.agent_config import AgentConfig
from agent.models.app import App
from agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
from agent.models.session import ChatSession
from agent.services.chat_access_service import (
    apply_runtime_llm_profile,
    resolve_chat_capability_token,
    validate_chat_capability_token,
)
from agent.services.chat_localization_service import resolve_locale
from agent.services.event_stream_service import event_stream_store
from agent.services.function_service import get_eligible_functions
from agent.services.orchestrator import MessageSender, run_agent_loop
from agent.services.pending_tool_results import (
    clear_pending_tool_result,
    register_pending_tool_result,
    resolve_pending_tool_result,
)
from agent.services.session_service import is_session_expired

router = APIRouter(tags=["chat-events"])


class ChatMessageBody(BaseModel):
    text: str
    request_id: str = Field(min_length=1, max_length=255)
    locale: str | None = None


class ChatMessageAccepted(BaseModel):
    turn_id: str
    request_id: str
    status: str = "accepted"


class ToolResultBody(BaseModel):
    turn_id: str
    idempotency_key: str = Field(min_length=1, max_length=255)
    call_id: str
    status: str
    result: Any | None = None
    error: str | None = None


@dataclass
class ActiveTurnState:
    turn_id: str | None = None
    request_id: str | None = None
    agent_task: asyncio.Task | None = None
    request_turns: dict[str, str] = field(default_factory=dict)
    tool_result_keys: set[str] = field(default_factory=set)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


_active_turns: dict[tuple[str, str], ActiveTurnState] = {}


def _turn_key(session_id: uuid.UUID, app_id: uuid.UUID) -> tuple[str, str]:
    return str(session_id), str(app_id)


def _get_or_create_active_turn(session_id: uuid.UUID, app_id: uuid.UUID) -> ActiveTurnState:
    key = _turn_key(session_id, app_id)
    state = _active_turns.get(key)
    if state is None:
        state = ActiveTurnState()
        _active_turns[key] = state
    return state


def _cleanup_active_turn_if_idle(session_id: uuid.UUID, app_id: uuid.UUID) -> None:
    key = _turn_key(session_id, app_id)
    state = _active_turns.get(key)
    if state is None:
        return
    if state.agent_task is not None and not state.agent_task.done():
        return
    _active_turns.pop(key, None)


class EventStreamSender(MessageSender):
    def __init__(self, session_id: uuid.UUID, app_id: uuid.UUID, turn_id: str, request_id: str):
        self._session_id = session_id
        self._app_id = app_id
        self._turn_id = turn_id
        self._request_id = request_id
        self._pending: dict[str, asyncio.Future] = {}

    async def _push(self, event_type: str, payload: dict[str, Any]) -> None:
        await event_stream_store.append(
            session_id=self._session_id,
            app_id=self._app_id,
            turn_id=self._turn_id,
            request_id=self._request_id,
            event_type=event_type,
            payload=payload,
        )

    async def send_text_delta(self, delta: str, accumulated: str) -> None:
        await self._push("assistant_text_delta", {"delta": delta, "accumulated": accumulated})

    async def send_tool_call_request(
        self,
        call_id: str,
        function_name: str,
        arguments: dict,
        timeout_seconds: int,
        human_description: str = "",
        requires_approval: bool = True,
    ) -> None:
        fut: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[call_id] = fut
        register_pending_tool_result(self._session_id, self._app_id, call_id, fut)
        await self._push("tool_call_request", {
            "call_id": call_id,
            "function_name": function_name,
            "arguments": arguments,
            "timeout_seconds": timeout_seconds,
            "human_description": human_description,
            "requires_approval": requires_approval,
        })

    async def send_turn_complete(self, full_text: str, usage: dict | None) -> None:
        await self._push("turn_complete", {"full_text": full_text, "usage": usage})

    async def send_error(self, code: str, message: str, recoverable: bool = True) -> None:
        await self._push("error", {"code": code, "message": message, "recoverable": recoverable})

    async def wait_for_tool_result(self, call_id: str, timeout: int) -> dict[str, Any]:
        fut = self._pending.get(call_id)
        if not fut:
            raise ValueError(f"No pending result for {call_id}")
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        finally:
            self._pending.pop(call_id, None)
            clear_pending_tool_result(self._session_id, self._app_id, call_id)


async def _load_runtime_context(db: AsyncSession, session_id: uuid.UUID, app: App) -> tuple[ChatSession, AgentConfig, OrganizationLLMProviderProfile]:
    session = await db.get(ChatSession, session_id)
    if not session or session.app_id != app.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    config_result = await db.execute(select(AgentConfig).where(AgentConfig.app_id == app.id))
    agent_config = config_result.scalar_one_or_none()
    if not agent_config:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent not configured")
    if agent_config.llm_profile_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="LLM profile is not configured")

    profile = await db.get(OrganizationLLMProviderProfile, agent_config.llm_profile_id)
    if profile is None or profile.organization_id != app.organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Configured LLM profile is invalid")

    apply_runtime_llm_profile(agent_config, profile)
    if await is_session_expired(db, session, agent_config.session_ttl_minutes):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session expired")

    return session, agent_config, profile


async def _run_turn(
    *,
    session_id: uuid.UUID,
    app_id: uuid.UUID,
    request_id: str,
    turn_id: str,
    text: str,
) -> None:
    try:
        async with async_session_factory() as db:
            session = await db.get(ChatSession, session_id)
            if session is None:
                return
            app = await db.get(App, app_id)
            if app is None:
                return
            agent_config_result = await db.execute(select(AgentConfig).where(AgentConfig.app_id == app.id))
            agent_config = agent_config_result.scalar_one_or_none()
            if agent_config is None or agent_config.llm_profile_id is None:
                return
            profile = await db.get(OrganizationLLMProviderProfile, agent_config.llm_profile_id)
            if profile is None:
                return
            apply_runtime_llm_profile(agent_config, profile)
            functions = await get_eligible_functions(db, app.id, session)
            sender = EventStreamSender(session.id, app.id, turn_id=turn_id, request_id=request_id)
            await run_agent_loop(db, session, agent_config, functions, text, sender)
    except Exception:
        await event_stream_store.append(
            session_id=session_id,
            app_id=app_id,
            turn_id=turn_id,
            request_id=request_id,
            event_type="error",
            payload={
                "code": "transport_error",
                "message": "Turn processing failed",
                "recoverable": True,
            },
        )
    finally:
        state = _get_or_create_active_turn(session_id, app_id)
        async with state.lock:
            if state.turn_id == turn_id:
                state.agent_task = None
                state.turn_id = None
                state.request_id = None
        _cleanup_active_turn_if_idle(session_id, app_id)


@router.get("/v1/sessions/{session_id}/events")
async def stream_events(
    session_id: uuid.UUID,
    request: Request,
    cursor: str | None = None,
    app: App = Depends(get_app_from_sdk_auth),
    db: AsyncSession = Depends(get_db),
):
    validate_chat_capability_token(
        token=resolve_chat_capability_token(request.headers),
        session_id=session_id,
        app=app,
    )
    session, _, _ = await _load_runtime_context(db, session_id, app)

    async def generate():
        last_event_id = cursor
        while True:
            try:
                events = await event_stream_store.wait_for_events(
                    session_id=session.id,
                    app_id=app.id,
                    after_event_id=last_event_id,
                    timeout=15.0,
                )
            except TimeoutError:
                yield ": keep-alive\n\n"
                continue

            if not events:
                yield ": keep-alive\n\n"
                continue

            for event in events:
                last_event_id = event["event_id"]
                yield f"id: {event['event_id']}\nevent: {event['type']}\ndata: {json.dumps(event)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/v1/sessions/{session_id}/messages", response_model=ChatMessageAccepted, status_code=status.HTTP_202_ACCEPTED)
async def submit_message(
    session_id: uuid.UUID,
    body: ChatMessageBody,
    request: Request,
    app: App = Depends(get_app_from_sdk_auth),
    db: AsyncSession = Depends(get_db),
):
    validate_chat_capability_token(
        token=resolve_chat_capability_token(request.headers),
        session_id=session_id,
        app=app,
    )
    session, _, _ = await _load_runtime_context(db, session_id, app)

    if body.locale:
        session.locale = resolve_locale(body.locale, [session.locale])
        await db.commit()
        await db.refresh(session)

    state = _get_or_create_active_turn(session.id, app.id)
    async with state.lock:
        existing_turn_id = state.request_turns.get(body.request_id)
        if existing_turn_id is not None:
            return ChatMessageAccepted(turn_id=existing_turn_id, request_id=body.request_id)
        if state.agent_task is not None and not state.agent_task.done():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A turn is already in progress")

        turn_id = str(uuid.uuid4())
        state.turn_id = turn_id
        state.request_id = body.request_id
        state.request_turns[body.request_id] = turn_id
        state.agent_task = asyncio.create_task(
            _run_turn(
                session_id=session.id,
                app_id=app.id,
                request_id=body.request_id,
                turn_id=turn_id,
                text=body.text,
            )
        )

    return ChatMessageAccepted(turn_id=turn_id, request_id=body.request_id)


@router.post("/v1/sessions/{session_id}/tool-results")
async def submit_tool_result(
    session_id: uuid.UUID,
    body: ToolResultBody,
    request: Request,
    app: App = Depends(get_app_from_sdk_auth),
):
    validate_chat_capability_token(
        token=resolve_chat_capability_token(request.headers),
        session_id=session_id,
        app=app,
    )

    state = _get_or_create_active_turn(session_id, app.id)
    dedupe_key = f"{body.turn_id}:{body.call_id}:{body.idempotency_key}"
    async with state.lock:
        if dedupe_key in state.tool_result_keys:
            return {"status": "ok", "deduplicated": True}
        state.tool_result_keys.add(dedupe_key)

    payload = {
        "call_id": body.call_id,
        "status": body.status,
        "result": body.result,
        "error": body.error,
    }
    if not resolve_pending_tool_result(session_id, app.id, body.call_id, payload):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending tool call with this ID")

    return {"status": "ok", "deduplicated": False}
