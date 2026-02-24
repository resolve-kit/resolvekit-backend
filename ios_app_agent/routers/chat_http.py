import asyncio
import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_app_from_api_key
from ios_app_agent.models.agent_config import AgentConfig
from ios_app_agent.models.app import App
from ios_app_agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
from ios_app_agent.models.session import ChatSession
from ios_app_agent.schemas.ws_protocol import ToolResultPayload
from ios_app_agent.services.chat_access_service import CHAT_CAPABILITY_HEADER, validate_chat_capability_token
from ios_app_agent.services.function_service import get_eligible_functions
from ios_app_agent.services.orchestrator import MessageSender, run_agent_loop
from ios_app_agent.services.session_service import is_session_expired

router = APIRouter(tags=["chat-http"])

# In-memory store for pending tool results in SSE mode
_pending_tool_results: dict[tuple[str, str, str], asyncio.Future] = {}


def _pending_key(session_id: uuid.UUID, app_id: uuid.UUID, call_id: str) -> tuple[str, str, str]:
    return str(session_id), str(app_id), call_id


class ChatMessageBody(BaseModel):
    text: str


class SSESender(MessageSender):
    def __init__(self, session_id: uuid.UUID, app_id: uuid.UUID):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._pending: dict[str, asyncio.Future] = {}
        self._session_id = session_id
        self._app_id = app_id

    async def _push(self, event: str, data: dict) -> None:
        await self._queue.put({"event": event, "data": data})

    async def send_text_delta(self, delta: str, accumulated: str) -> None:
        await self._push("assistant_text_delta", {"delta": delta, "accumulated": accumulated})

    async def send_tool_call_request(
        self, call_id: str, function_name: str, arguments: dict, timeout_seconds: int, human_description: str = ""
    ) -> None:
        fut: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[call_id] = fut
        _pending_tool_results[_pending_key(self._session_id, self._app_id, call_id)] = fut
        await self._push("tool_call_request", {
            "call_id": call_id,
            "function_name": function_name,
            "arguments": arguments,
            "timeout_seconds": timeout_seconds,
            "human_description": human_description,
        })

    async def send_turn_complete(self, full_text: str, usage: dict | None) -> None:
        await self._push("turn_complete", {"full_text": full_text, "usage": usage})
        await self._queue.put(None)  # Signal stream end

    async def send_error(self, code: str, message: str, recoverable: bool = True) -> None:
        await self._push("error", {"code": code, "message": message, "recoverable": recoverable})
        await self._queue.put(None)

    async def wait_for_tool_result(self, call_id: str, timeout: int) -> dict[str, Any]:
        fut = self._pending.get(call_id)
        if not fut:
            raise ValueError(f"No pending result for {call_id}")
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        finally:
            self._pending.pop(call_id, None)
            _pending_tool_results.pop(_pending_key(self._session_id, self._app_id, call_id), None)


@router.post("/v1/sessions/{session_id}/messages")
async def send_message_sse(
    session_id: uuid.UUID,
    body: ChatMessageBody,
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

    config_result = await db.execute(select(AgentConfig).where(AgentConfig.app_id == app.id))
    agent_config = config_result.scalar_one_or_none()
    if not agent_config:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent not configured")
    if agent_config.llm_profile_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="LLM profile is not configured")

    profile = await db.get(OrganizationLLMProviderProfile, agent_config.llm_profile_id)
    if profile is None or profile.organization_id != app.organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Configured LLM profile is invalid")

    # Runtime provider credentials are resolved from org-scoped profile.
    agent_config.llm_provider = profile.provider
    agent_config.llm_model = profile.model
    agent_config.llm_api_key_encrypted = profile.api_key_encrypted
    agent_config.llm_api_base = profile.api_base

    if await is_session_expired(db, session, agent_config.session_ttl_minutes):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Session expired")

    functions = await get_eligible_functions(db, app.id, session)
    sender = SSESender(session.id, app.id)

    async def generate():
        task = asyncio.create_task(run_agent_loop(db, session, agent_config, functions, body.text, sender))
        try:
            while True:
                item = await sender._queue.get()
                if item is None:
                    break
                event = item["event"]
                data = json.dumps(item["data"])
                yield f"event: {event}\ndata: {data}\n\n"
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/v1/sessions/{session_id}/tool-results")
async def submit_tool_result(
    session_id: uuid.UUID,
    body: ToolResultPayload,
    request: Request,
    app: App = Depends(get_app_from_api_key),
):
    validate_chat_capability_token(
        token=request.headers.get(CHAT_CAPABILITY_HEADER),
        session_id=session_id,
        app=app,
    )

    fut = _pending_tool_results.get(_pending_key(session_id, app.id, body.call_id))
    if not fut:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending tool call with this ID")

    if not fut.done():
        fut.set_result(body.model_dump())
    return {"status": "ok"}
