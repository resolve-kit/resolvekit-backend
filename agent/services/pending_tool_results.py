import asyncio
import json
import logging
import uuid
from typing import Any

from agent.services.runtime_redis_service import get_redis_client, redis_enabled

logger = logging.getLogger(__name__)

_pending_tool_results: dict[tuple[str, str, str], asyncio.Future] = {}

# ---------------------------------------------------------------------------
# Shared pub/sub listener
# ---------------------------------------------------------------------------
# Instead of spawning one asyncio task per pending tool call (which creates
# O(active_sessions × avg_tool_calls) tasks), a single task per process
# subscribes to the pattern "rk:tool_notify:*" and dispatches notifications
# to the correct local Future.  This reduces asyncio task count and Redis
# subscription overhead from O(N) to O(1) per process.
# ---------------------------------------------------------------------------
_shared_listener_task: asyncio.Task | None = None


async def start_shared_tool_listener() -> None:
    """Start the shared pub/sub listener.  Called once at application startup."""
    global _shared_listener_task
    if not redis_enabled():
        return
    _shared_listener_task = asyncio.create_task(
        _shared_pubsub_listener(),
        name="shared_tool_result_listener",
    )


async def stop_shared_tool_listener() -> None:
    """Cancel the shared pub/sub listener.  Called once at application shutdown."""
    global _shared_listener_task
    if _shared_listener_task is not None and not _shared_listener_task.done():
        _shared_listener_task.cancel()
        try:
            await _shared_listener_task
        except asyncio.CancelledError:
            pass
        _shared_listener_task = None


async def _shared_pubsub_listener() -> None:
    """Single background task that routes all tool result notifications."""
    try:
        redis = await get_redis_client()
        if redis is None:
            return

        pubsub = redis.pubsub()
        # Pattern matches all channels of the form rk:tool_notify:{app_id}:{session_id}:{call_id}
        await pubsub.psubscribe("rk:tool_notify:*")
        logger.info("shared_tool_result_listener started")
        try:
            while True:
                try:
                    message = await asyncio.wait_for(
                        pubsub.get_message(ignore_subscribe_messages=True, timeout=5.0),
                        timeout=10.0,
                    )
                except asyncio.TimeoutError:
                    continue
                if message and message.get("type") == "pmessage":
                    channel = message.get("channel", "")
                    asyncio.create_task(
                        _dispatch_tool_notification(channel),
                        name=f"tool_dispatch_{channel}",
                    )
        finally:
            try:
                await pubsub.punsubscribe("rk:tool_notify:*")
                await pubsub.aclose()
            except Exception:
                pass
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("shared_tool_result_listener_crashed — tool delivery may be impaired")


async def _dispatch_tool_notification(channel: str) -> None:
    """Resolve the local Future for this tool notification, if one exists."""
    # Channel format: rk:tool_notify:{app_id}:{session_id}:{call_id}
    # Split into at most 5 parts so call_id may contain colons.
    parts = channel.split(":", 4)
    if len(parts) != 5:
        return
    _, _, app_id_str, session_id_str, call_id = parts

    key = (session_id_str, app_id_str, call_id)
    fut = _pending_tool_results.get(key)
    if fut is None or fut.done():
        return

    redis = await get_redis_client()
    if redis is None:
        return

    result_key = f"rk:tool_result:{app_id_str}:{session_id_str}:{call_id}"
    raw = await redis.get(result_key)
    if raw is None:
        return
    try:
        payload = json.loads(raw)
        if isinstance(payload, dict) and not fut.done():
            fut.set_result(payload)
    except Exception:
        logger.warning("failed_to_decode_tool_result call_id=%s", call_id)


def _pending_key(session_id: uuid.UUID, app_id: uuid.UUID, call_id: str) -> tuple[str, str, str]:
    return str(session_id), str(app_id), call_id


async def register_pending_tool_result(
    session_id: uuid.UUID,
    app_id: uuid.UUID,
    call_id: str,
    fut: asyncio.Future,
) -> None:
    """Register a local Future and, if needed, check for early Redis arrival."""
    key = _pending_key(session_id, app_id, call_id)
    _pending_tool_results[key] = fut

    redis = await get_redis_client()
    if redis is None or not redis_enabled():
        return

    # Check for early arrival (result submitted before we registered the Future)
    result_key = f"rk:tool_result:{app_id}:{session_id}:{call_id}"
    early = await redis.get(result_key)
    if early is not None:
        try:
            payload = json.loads(early)
            if isinstance(payload, dict) and not fut.done():
                fut.set_result(payload)
                await redis.delete(result_key)
        except Exception:
            pass
    # No per-call listener task needed — the shared listener handles delivery.


def clear_pending_tool_result(session_id: uuid.UUID, app_id: uuid.UUID, call_id: str) -> None:
    _pending_tool_results.pop(_pending_key(session_id, app_id, call_id), None)


async def resolve_pending_tool_result(
    session_id: uuid.UUID,
    app_id: uuid.UUID,
    call_id: str,
    result: dict[str, Any],
) -> bool:
    """Write result to Redis + publish notification + try local resolve."""
    # 1. Try Redis persistence for cross-process delivery
    redis = await get_redis_client()
    if redis is not None and redis_enabled():
        result_key = f"rk:tool_result:{app_id}:{session_id}:{call_id}"
        await redis.set(result_key, json.dumps(result), ex=600)
        channel_name = f"rk:tool_notify:{app_id}:{session_id}:{call_id}"
        await redis.publish(channel_name, "ready")

    # 2. Try local future resolve (same-process fast path)
    key = _pending_key(session_id, app_id, call_id)
    fut = _pending_tool_results.get(key)
    if fut is not None:
        if not fut.done():
            fut.set_result(result)
        return True

    # 3. If no local future, check if there's an active turn in Redis
    if redis is not None and redis_enabled():
        lock_key = f"rk:turn:lock:{app_id}:{session_id}"
        has_turn = await redis.exists(lock_key)
        return has_turn > 0

    return False
