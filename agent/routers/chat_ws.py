import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.database import async_session_factory
from agent.config import settings
from agent.models.agent_config import AgentConfig
from agent.models.api_key import ApiKey
from agent.models.app import App
from agent.models.organization_llm_provider_profile import OrganizationLLMProviderProfile
from agent.models.session import ChatSession
from agent.services.chat_access_service import (
    CHAT_CAPABILITY_QUERY,
    CHAT_UNAVAILABLE_CODE,
    CHAT_UNAVAILABLE_MESSAGE,
    apply_runtime_llm_profile,
    ensure_chat_available_for_app,
    validate_chat_capability_token,
)
from agent.services.chat_localization_service import resolve_locale
from agent.services.function_service import get_eligible_functions
from agent.services.orchestrator import MessageSender, run_agent_loop
from agent.services.pending_tool_results import (
    clear_pending_tool_result,
    register_pending_tool_result,
    resolve_pending_tool_result,
)
from agent.services.session_service import is_session_expired
from agent.services.ws_ticket_service import consume_ws_ticket

router = APIRouter(tags=["chat-ws"])


class WebSocketSender(MessageSender):
    def __init__(self, ws: WebSocket, session_id: uuid.UUID, app_id: uuid.UUID):
        self.ws = ws
        self._session_id = session_id
        self._app_id = app_id
        self._pending_results: dict[str, asyncio.Future] = {}

    async def _send(self, msg_type: str, payload: dict, request_id: str | None = None) -> None:
        await self.ws.send_json({
            "type": msg_type,
            "request_id": request_id,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    async def send_text_delta(self, delta: str, accumulated: str) -> None:
        await self._send("assistant_text_delta", {"delta": delta, "accumulated": accumulated})

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
        self._pending_results[call_id] = fut
        register_pending_tool_result(self._session_id, self._app_id, call_id, fut)
        await self._send("tool_call_request", {
            "call_id": call_id,
            "function_name": function_name,
            "arguments": arguments,
            "timeout_seconds": timeout_seconds,
            "human_description": human_description,
            "requires_approval": requires_approval,
        })

    async def send_turn_complete(self, full_text: str, usage: dict | None) -> None:
        await self._send("turn_complete", {"full_text": full_text, "usage": usage})

    async def send_error(self, code: str, message: str, recoverable: bool = True) -> None:
        await self._send("error", {"code": code, "message": message, "recoverable": recoverable})

    async def wait_for_tool_result(self, call_id: str, timeout: int) -> dict[str, Any]:
        fut = self._pending_results.get(call_id)
        if not fut:
            raise ValueError(f"No pending result for {call_id}")
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        finally:
            self._pending_results.pop(call_id, None)
            clear_pending_tool_result(self._session_id, self._app_id, call_id)

    def resolve_tool_result(self, call_id: str, result: dict) -> None:
        if resolve_pending_tool_result(self._session_id, self._app_id, call_id, result):
            return

        # Local fallback keeps behaviour stable when sender owns the future.
        fut = self._pending_results.get(call_id)
        if fut and not fut.done():
            fut.set_result(result)

    def clear_pending_results(self) -> None:
        for call_id, fut in list(self._pending_results.items()):
            clear_pending_tool_result(self._session_id, self._app_id, call_id)
            if not fut.done():
                fut.cancel()
        self._pending_results.clear()


async def authenticate_ws(ws: WebSocket, db: AsyncSession) -> tuple[App | None, bool]:
    ws_ticket = ws.query_params.get("ticket")
    session_id_raw = ws.path_params.get("session_id")
    if ws_ticket and session_id_raw:
        try:
            session_id = uuid.UUID(str(session_id_raw))
        except ValueError:
            return None, False
        app = await consume_ws_ticket(db, ws_ticket, session_id)
        if app:
            return app, True

    if not settings.allow_legacy_ws_api_key:
        return None, False

    api_key_raw = ws.query_params.get("api_key")
    if not api_key_raw:
        return None, False

    key_hash = hashlib.sha256(api_key_raw.encode()).hexdigest()
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        return None, False

    return await db.get(App, api_key.app_id), False


@router.websocket("/v1/sessions/{session_id}/ws")
async def chat_websocket(ws: WebSocket, session_id: uuid.UUID):
    await ws.accept()

    async with async_session_factory() as db:
        # Auth
        app, used_ws_ticket = await authenticate_ws(ws, db)
        if not app:
            await ws.send_json({"type": "error", "payload": {"code": "auth_failed", "message": "Invalid WebSocket auth ticket"}})
            await ws.close(code=4001)
            return

        capability_token = ws.query_params.get(CHAT_CAPABILITY_QUERY)
        if not used_ws_ticket or capability_token:
            try:
                validate_chat_capability_token(token=capability_token, session_id=session_id, app=app)
            except HTTPException:
                await ws.send_json(
                    {"type": "error", "payload": {"code": CHAT_UNAVAILABLE_CODE, "message": CHAT_UNAVAILABLE_MESSAGE, "recoverable": True}}
                )
                await ws.close(code=4003)
                return

        # Validate session
        session = await db.get(ChatSession, session_id)
        if not session or session.app_id != app.id:
            await ws.send_json({"type": "error", "payload": {"code": "session_not_found", "message": "Session not found"}})
            await ws.close(code=4004)
            return

        # Load config
        config = await db.execute(select(AgentConfig).where(AgentConfig.app_id == app.id))
        agent_config = config.scalar_one_or_none()
        if not agent_config:
            await ws.send_json({"type": "error", "payload": {"code": "no_config", "message": "Agent not configured"}})
            await ws.close(code=4002)
            return
        if agent_config.llm_profile_id is None:
            await ws.send_json(
                {"type": "error", "payload": {"code": "no_llm_profile", "message": "LLM profile is not configured"}}
            )
            await ws.close(code=4002)
            return

        profile = await db.get(OrganizationLLMProviderProfile, agent_config.llm_profile_id)
        if profile is None or profile.organization_id != app.organization_id:
            await ws.send_json(
                {"type": "error", "payload": {"code": "invalid_llm_profile", "message": "Configured LLM profile is invalid"}}
            )
            await ws.close(code=4002)
            return

        # Runtime provider credentials are resolved from org-scoped profile.
        # The model remains app-configured on AgentConfig.
        apply_runtime_llm_profile(agent_config, profile)

        # Check expiry
        if await is_session_expired(db, session, agent_config.session_ttl_minutes):
            await ws.send_json({"type": "error", "payload": {"code": "session_expired", "message": "Session expired"}})
            await ws.close(code=4003)
            return

        sender = WebSocketSender(ws, session.id, app.id)
        agent_task: asyncio.Task | None = None
        last_rx_at: float = asyncio.get_event_loop().time()

        async def watch_agent_task(task: asyncio.Task) -> None:
            nonlocal agent_task
            try:
                await task
            except asyncio.CancelledError:
                return
            except Exception:
                await sender.send_error(
                    "agent_error",
                    "Assistant is temporarily unavailable. Please try again.",
                    recoverable=True,
                )
            finally:
                if agent_task is task:
                    agent_task = None

        async def keepalive_task_fn() -> None:
            nonlocal last_rx_at
            interval = 30.0
            dead_timeout = 60.0
            while True:
                await asyncio.sleep(interval)
                elapsed = asyncio.get_event_loop().time() - last_rx_at
                if elapsed > dead_timeout:
                    try:
                        await ws.close(code=1001)
                    except Exception:
                        pass
                    return
                try:
                    await sender._send("ping", {})
                except Exception:
                    return

        keepalive_task = asyncio.create_task(keepalive_task_fn())
        try:
            while True:
                raw = await ws.receive_text()
                last_rx_at = asyncio.get_event_loop().time()
                try:
                    envelope = json.loads(raw)
                except json.JSONDecodeError:
                    await sender.send_error("invalid_json", "Invalid JSON")
                    continue

                msg_type = envelope.get("type")

                if msg_type == "ping":
                    await sender._send("pong", {})

                elif msg_type == "tool_result":
                    payload = envelope.get("payload", {})
                    call_id = payload.get("call_id")
                    if call_id:
                        sender.resolve_tool_result(call_id, payload)

                elif msg_type == "chat_message":
                    await db.refresh(app)
                    try:
                        ensure_chat_available_for_app(app)
                    except HTTPException:
                        await sender.send_error(CHAT_UNAVAILABLE_CODE, CHAT_UNAVAILABLE_MESSAGE)
                        continue

                    # Check if a turn is already running
                    if agent_task is not None and not agent_task.done():
                        await sender.send_error("turn_in_progress", "A turn is already in progress")
                        continue

                    # Previous task is finished; clear the slot before launching a new turn.
                    if agent_task is not None and agent_task.done():
                        agent_task = None

                    text = envelope.get("payload", {}).get("text", "").strip()
                    locale = envelope.get("payload", {}).get("locale")
                    if not text:
                        await sender.send_error("empty_message", "Message text is required")
                        continue

                    # Re-check expiry
                    await db.refresh(session)
                    if await is_session_expired(db, session, agent_config.session_ttl_minutes):
                        await sender.send_error("session_expired", "Session expired", recoverable=False)
                        break

                    if isinstance(locale, str) and locale.strip():
                        session.locale = resolve_locale(locale, [session.locale])
                        await db.commit()
                        await db.refresh(session)

                    functions = await get_eligible_functions(db, app.id, session)

                    # Launch agent loop as background task so the receive loop
                    # stays free to route tool_result messages back to the orchestrator
                    agent_task = asyncio.create_task(
                        run_agent_loop(db, session, agent_config, functions, text, sender)
                    )
                    asyncio.create_task(watch_agent_task(agent_task))

        except WebSocketDisconnect:
            keepalive_task.cancel()
            try:
                await keepalive_task
            except (asyncio.CancelledError, Exception):
                pass

            sender.clear_pending_results()

            # Cancel any in-flight agent task on disconnect
            if agent_task is not None and not agent_task.done():
                agent_task.cancel()
                try:
                    await agent_task
                except (asyncio.CancelledError, Exception):
                    pass
