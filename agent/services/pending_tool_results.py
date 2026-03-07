import asyncio
import json
import logging
import uuid
from typing import Any

from agent.services.runtime_redis_service import get_redis_client, redis_enabled

logger = logging.getLogger(__name__)

_pending_tool_results: dict[tuple[str, str, str], asyncio.Future] = {}


def _pending_key(session_id: uuid.UUID, app_id: uuid.UUID, call_id: str) -> tuple[str, str, str]:
    return str(session_id), str(app_id), call_id


async def register_pending_tool_result(
    session_id: uuid.UUID,
    app_id: uuid.UUID,
    call_id: str,
    fut: asyncio.Future,
) -> None:
    """Register a local Future and start listening for cross-process delivery."""
    key = _pending_key(session_id, app_id, call_id)
    _pending_tool_results[key] = fut

    redis = await get_redis_client()
    if redis is None or not redis_enabled():
        return

    # Check for early arrival (tool result submitted before we started listening)
    result_key = f"rk:tool_result:{app_id}:{session_id}:{call_id}"
    early = await redis.get(result_key)
    if early is not None:
        try:
            payload = json.loads(early)
            if isinstance(payload, dict) and not fut.done():
                fut.set_result(payload)
                await redis.delete(result_key)
                return
        except Exception:
            pass

    # Start background pub/sub listener for cross-process notification
    asyncio.create_task(
        _listen_for_tool_result(session_id, app_id, call_id, fut),
        name=f"tool_result_listener_{call_id}",
    )


async def _listen_for_tool_result(
    session_id: uuid.UUID,
    app_id: uuid.UUID,
    call_id: str,
    fut: asyncio.Future,
) -> None:
    """Background task that subscribes to pub/sub for cross-process tool result notification."""
    try:
        redis = await get_redis_client()
        if redis is None:
            return

        channel_name = f"rk:tool_notify:{app_id}:{session_id}:{call_id}"
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel_name)
        try:
            while not fut.done():
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=5.0,
                )
                if message and message.get("type") == "message":
                    # Notification received — fetch the result from Redis key
                    result_key = f"rk:tool_result:{app_id}:{session_id}:{call_id}"
                    raw = await redis.get(result_key)
                    if raw is not None:
                        try:
                            payload = json.loads(raw)
                            if isinstance(payload, dict) and not fut.done():
                                fut.set_result(payload)
                        except Exception:
                            logger.warning("Failed to decode tool result for %s", call_id)
                    break
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.aclose()
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.debug("Tool result listener ended for %s", call_id, exc_info=True)


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
