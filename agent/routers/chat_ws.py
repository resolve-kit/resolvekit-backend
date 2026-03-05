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
from agent.services.runtime_redis_service import (
    claim_or_get_owner,
    pop_outbox_frames,
    pop_tool_result,
    push_outbox_frame,
    refresh_owner,
    store_tool_result,
)
from agent.services.session_service import is_session_expired
from agent.services.ws_ticket_service import consume_ws_ticket

router = APIRouter(tags=["chat-ws"])


class WebSocketSender(MessageSender):
    def __init__(self, session_id: uuid.UUID, app_id: uuid.UUID):
        self._session_id = session_id
        self._app_id = app_id
        self._ws: WebSocket | None = None
        self._pending_results: dict[str, asyncio.Future] = {}
        self._outbox: list[dict[str, Any]] = []
        self._max_outbox_size = 256

    @property
    def has_active_socket(self) -> bool:
        return self._ws is not None

    async def attach_ws(self, ws: WebSocket) -> None:
        self._ws = ws
        await self.flush_redis_outbox()
        if not self._outbox:
            return

        queued = list(self._outbox)
        self._outbox.clear()
        for index, frame in enumerate(queued):
            try:
                await ws.send_json(frame)
            except Exception:
                self._ws = None
                self._enqueue_outgoing_frame(frame)
                for rest in queued[index + 1:]:
                    self._enqueue_outgoing_frame(rest)
                return

    async def flush_redis_outbox(self) -> None:
        if self._ws is None:
            return
        frames = await pop_outbox_frames(str(self._session_id), str(self._app_id))
        if not frames:
            return
        for frame in frames:
            try:
                await self._ws.send_json(frame)
            except Exception:
                self._ws = None
                self._enqueue_outgoing_frame(frame)
                break

    def detach_ws(self) -> None:
        self._ws = None

    def _enqueue_outgoing_frame(self, frame: dict[str, Any]) -> None:
        self._outbox.append(frame)
        if len(self._outbox) > self._max_outbox_size:
            self._outbox = self._outbox[-self._max_outbox_size :]

    async def _send(self, msg_type: str, payload: dict, request_id: str | None = None) -> None:
        frame = {
            "type": msg_type,
            "request_id": request_id,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        ws = self._ws
        if ws is None:
            self._enqueue_outgoing_frame(frame)
            await push_outbox_frame(
                str(self._session_id),
                str(self._app_id),
                frame,
                ttl_seconds=settings.ws_outbox_ttl_seconds,
            )
            return
        try:
            await ws.send_json(frame)
        except Exception:
            self._ws = None
            self._enqueue_outgoing_frame(frame)
            await push_outbox_frame(
                str(self._session_id),
                str(self._app_id),
                frame,
                ttl_seconds=settings.ws_outbox_ttl_seconds,
            )

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
        deadline = asyncio.get_event_loop().time() + timeout
        try:
            while True:
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 0:
                    raise asyncio.TimeoutError
                if fut is not None:
                    try:
                        return await asyncio.wait_for(asyncio.shield(fut), timeout=min(0.25, remaining))
                    except asyncio.TimeoutError:
                        pass
                redis_payload = await pop_tool_result(str(self._session_id), str(self._app_id), call_id)
                if redis_payload is not None:
                    if fut is not None and not fut.done():
                        fut.set_result(redis_payload)
                    return redis_payload
                await asyncio.sleep(min(0.1, remaining))
        finally:
            self._pending_results.pop(call_id, None)
            clear_pending_tool_result(self._session_id, self._app_id, call_id)

    async def resolve_tool_result(self, call_id: str, result: dict) -> None:
        if resolve_pending_tool_result(self._session_id, self._app_id, call_id, result):
            await store_tool_result(
                str(self._session_id),
                str(self._app_id),
                call_id,
                result,
                ttl_seconds=settings.ws_tool_result_ttl_seconds,
            )
            return

        # Local fallback keeps behaviour stable when sender owns the future.
        fut = self._pending_results.get(call_id)
        if fut and not fut.done():
            fut.set_result(result)
        await store_tool_result(
            str(self._session_id),
            str(self._app_id),
            call_id,
            result,
            ttl_seconds=settings.ws_tool_result_ttl_seconds,
        )

    def clear_pending_results(self) -> None:
        for call_id, fut in list(self._pending_results.items()):
            clear_pending_tool_result(self._session_id, self._app_id, call_id)
            if not fut.done():
                fut.cancel()
        self._pending_results.clear()


class ActiveTurnState:
    def __init__(self, sender: WebSocketSender):
        self.sender = sender
        self.agent_task: asyncio.Task | None = None


_active_turns: dict[tuple[str, str], ActiveTurnState] = {}


def _turn_key(session_id: uuid.UUID, app_id: uuid.UUID) -> tuple[str, str]:
    return str(session_id), str(app_id)


def _get_or_create_active_turn(session_id: uuid.UUID, app_id: uuid.UUID) -> ActiveTurnState:
    key = _turn_key(session_id, app_id)
    state = _active_turns.get(key)
    if state is None:
        state = ActiveTurnState(sender=WebSocketSender(session_id=session_id, app_id=app_id))
        _active_turns[key] = state
    return state


def _cleanup_active_turn_if_idle(session_id: uuid.UUID, app_id: uuid.UUID) -> None:
    key = _turn_key(session_id, app_id)
    state = _active_turns.get(key)
    if state is None:
        return
    if state.sender.has_active_socket:
        return
    if state.agent_task is not None and not state.agent_task.done():
        return
    _active_turns.pop(key, None)


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

        session_id_str = str(session.id)
        app_id_str = str(app.id)
        owner_id = await claim_or_get_owner(
            session_id=session_id_str,
            app_id=app_id_str,
            instance_id=settings.instance_id,
            ttl_seconds=settings.ws_owner_ttl_seconds,
        )
        is_owner = owner_id == settings.instance_id

        if not is_owner:
            relay_sender = WebSocketSender(session_id=session.id, app_id=app.id)
            await relay_sender.attach_ws(ws)
            last_rx_at: float = asyncio.get_event_loop().time()

            async def relay_keepalive_task_fn() -> None:
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
                    await relay_sender._send("ping", {})

            async def relay_outbox_task_fn() -> None:
                while True:
                    await relay_sender.flush_redis_outbox()
                    await asyncio.sleep(0.2)

            relay_keepalive_task = asyncio.create_task(relay_keepalive_task_fn())
            relay_outbox_task = asyncio.create_task(relay_outbox_task_fn())
            try:
                while True:
                    raw = await ws.receive_text()
                    last_rx_at = asyncio.get_event_loop().time()
                    try:
                        envelope = json.loads(raw)
                    except json.JSONDecodeError:
                        await relay_sender.send_error("invalid_json", "Invalid JSON")
                        continue

                    msg_type = envelope.get("type")
                    if msg_type == "ping":
                        await relay_sender._send("pong", {})
                        continue
                    if msg_type == "tool_result":
                        payload = envelope.get("payload", {})
                        call_id = payload.get("call_id")
                        if call_id:
                            await relay_sender.resolve_tool_result(call_id, payload)
                        continue
                    if msg_type == "chat_message":
                        await relay_sender.send_error(
                            "turn_relay_active",
                            "Recovering in-flight turn. Please wait for completion before sending a new message.",
                            recoverable=True,
                        )
            except WebSocketDisconnect:
                relay_sender.detach_ws()
            finally:
                relay_keepalive_task.cancel()
                relay_outbox_task.cancel()
                try:
                    await relay_keepalive_task
                except (asyncio.CancelledError, Exception):
                    pass
                try:
                    await relay_outbox_task
                except (asyncio.CancelledError, Exception):
                    pass
            return

        turn_state = _get_or_create_active_turn(session.id, app.id)
        sender = turn_state.sender
        await sender.attach_ws(ws)
        last_rx_at: float = asyncio.get_event_loop().time()

        async def watch_agent_task(task: asyncio.Task) -> None:
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
                if turn_state.agent_task is task:
                    turn_state.agent_task = None
                sender.clear_pending_results()
                _cleanup_active_turn_if_idle(session.id, app.id)

        async def owner_lease_task_fn() -> None:
            interval = max(5, settings.ws_owner_ttl_seconds // 3)
            while True:
                await refresh_owner(
                    session_id=session_id_str,
                    app_id=app_id_str,
                    instance_id=settings.instance_id,
                    ttl_seconds=settings.ws_owner_ttl_seconds,
                )
                await asyncio.sleep(interval)

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
        owner_lease_task = asyncio.create_task(owner_lease_task_fn())
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
                        await sender.resolve_tool_result(call_id, payload)

                elif msg_type == "chat_message":
                    await db.refresh(app)
                    try:
                        ensure_chat_available_for_app(app)
                    except HTTPException:
                        await sender.send_error(CHAT_UNAVAILABLE_CODE, CHAT_UNAVAILABLE_MESSAGE)
                        continue

                    # Check if a turn is already running
                    if turn_state.agent_task is not None and not turn_state.agent_task.done():
                        await sender.send_error("turn_in_progress", "A turn is already in progress")
                        continue

                    # Previous task is finished; clear the slot before launching a new turn.
                    if turn_state.agent_task is not None and turn_state.agent_task.done():
                        turn_state.agent_task = None

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
                    turn_state.agent_task = asyncio.create_task(
                        run_agent_loop(db, session, agent_config, functions, text, sender)
                    )
                    asyncio.create_task(watch_agent_task(turn_state.agent_task))

        except WebSocketDisconnect:
            keepalive_task.cancel()
            try:
                await keepalive_task
            except (asyncio.CancelledError, Exception):
                pass

            sender.detach_ws()
            if turn_state.agent_task is not None and not turn_state.agent_task.done():
                try:
                    await turn_state.agent_task
                except (asyncio.CancelledError, Exception):
                    pass
            owner_lease_task.cancel()
            try:
                await owner_lease_task
            except (asyncio.CancelledError, Exception):
                pass
            _cleanup_active_turn_if_idle(session.id, app.id)
