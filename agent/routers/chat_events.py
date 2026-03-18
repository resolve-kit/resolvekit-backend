import asyncio
import json
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
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
from agent.services.turn_state_service import turn_state_store

router = APIRouter(tags=["chat-events"])

_MAX_MESSAGE_TEXT_BYTES = 32_768  # 32 KB hard cap on user message text
_MAX_TOOL_ERROR_LENGTH = 4_096   # 4 KB cap on tool error strings
_SSE_MAX_DURATION_SECONDS = 300  # 5-minute hard cap per SSE connection
_SSE_POLL_TIMEOUT_SECONDS = 15.0


class ChatMessageBody(BaseModel):
    text: str = Field(min_length=1, max_length=_MAX_MESSAGE_TEXT_BYTES)
    request_id: str = Field(min_length=1, max_length=255)
    locale: str | None = None

    @field_validator("text")
    @classmethod
    def validate_text_utf8_size(cls, value: str) -> str:
        if len(value.encode("utf-8")) > _MAX_MESSAGE_TEXT_BYTES:
            raise ValueError(f"String should have at most {_MAX_MESSAGE_TEXT_BYTES} bytes")
        return value


class ChatMessageAccepted(BaseModel):
    turn_id: str
    request_id: str
    status: str = "accepted"


class ToolResultBody(BaseModel):
    turn_id: str
    idempotency_key: str = Field(min_length=1, max_length=255)
    call_id: str = Field(min_length=1, max_length=255)
    status: str = Field(min_length=1, max_length=32)
    result: Any | None = None
    error: str | None = Field(default=None, max_length=_MAX_TOOL_ERROR_LENGTH)


_active_tasks: dict[tuple[str, str], asyncio.Task] = {}


def _task_key(session_id: uuid.UUID, app_id: uuid.UUID) -> tuple[str, str]:
    return str(session_id), str(app_id)


def _cleanup_task_if_done(session_id: uuid.UUID, app_id: uuid.UUID) -> None:
    key = _task_key(session_id, app_id)
    task = _active_tasks.get(key)
    if task is None or task.done():
        _active_tasks.pop(key, None)


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
        await register_pending_tool_result(self._session_id, self._app_id, call_id, fut)
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
        await turn_state_store.clear_turn(session_id=session_id, app_id=app_id, turn_id=turn_id)
        _cleanup_task_if_done(session_id, app_id)


@router.get("/v1/sessions/{session_id}/events")
async def stream_events(
    session_id: uuid.UUID,
    request: Request,
    cursor: str | None = None,
    app: App = Depends(get_app_from_sdk_auth),
):
    validate_chat_capability_token(
        token=resolve_chat_capability_token(request.headers),
        session_id=session_id,
        app=app,
    )
    async with async_session_factory() as db:
        session, _, _ = await _load_runtime_context(db, session_id, app)

    async def generate():
        last_event_id = cursor
        deadline = time.monotonic() + _SSE_MAX_DURATION_SECONDS
        yield ": connected\n\n"
        while time.monotonic() < deadline:
            remaining = deadline - time.monotonic()
            poll_timeout = min(_SSE_POLL_TIMEOUT_SECONDS, remaining)
            if poll_timeout <= 0:
                break
            try:
                events = await event_stream_store.wait_for_events(
                    session_id=session.id,
                    app_id=app.id,
                    after_event_id=last_event_id,
                    timeout=poll_timeout,
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

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


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

    turn_id = str(uuid.uuid4())
    resolved_turn_id, is_new = await turn_state_store.try_start_turn(
        session_id=session.id,
        app_id=app.id,
        request_id=body.request_id,
        turn_id=turn_id,
    )

    if is_new:
        key = _task_key(session.id, app.id)
        _active_tasks[key] = asyncio.create_task(
            _run_turn(
                session_id=session.id,
                app_id=app.id,
                request_id=body.request_id,
                turn_id=resolved_turn_id,
                text=body.text,
            )
        )

    return ChatMessageAccepted(turn_id=resolved_turn_id, request_id=body.request_id)


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

    dedupe_key = f"{body.turn_id}:{body.call_id}:{body.idempotency_key}"
    is_dup = await turn_state_store.check_and_add_dedup_key(
        session_id=session_id, app_id=app.id, key=dedupe_key,
    )
    if is_dup:
        return {"status": "ok", "deduplicated": True}

    payload = {
        "call_id": body.call_id,
        "status": body.status,
        "result": body.result,
        "error": body.error,
    }
    if not await resolve_pending_tool_result(session_id, app.id, body.call_id, payload):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending tool call with this ID")

    return {"status": "ok", "deduplicated": False}
