import asyncio
import json
import logging
from typing import Any

try:
    from redis.asyncio import Redis

    _redis_import_error: Exception | None = None
except Exception as exc:  # pragma: no cover - import failure fallback
    Redis = Any  # type: ignore[misc,assignment]
    _redis_import_error = exc

from agent.config import settings

logger = logging.getLogger(__name__)

_redis_client: Redis | None = None
_redis_lock = asyncio.Lock()


def redis_enabled() -> bool:
    return bool((settings.redis_url or "").strip())


async def _get_redis() -> Redis | None:
    if not redis_enabled():
        return None
    if _redis_import_error is not None:
        logger.warning("redis_unavailable_import_error=%s", _redis_import_error.__class__.__name__)
        return None

    global _redis_client
    if _redis_client is not None:
        return _redis_client

    async with _redis_lock:
        if _redis_client is not None:
            return _redis_client
        client = Redis.from_url(settings.redis_url, decode_responses=True)
        try:
            await client.ping()
        except Exception:
            logger.exception("redis_connect_failed")
            await client.aclose()
            return None
        _redis_client = client
        return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client is None:
        return
    try:
        await _redis_client.aclose()
    finally:
        _redis_client = None


async def get_redis_client() -> Redis | None:
    return await _get_redis()


def _owner_key(session_id: str, app_id: str) -> str:
    return f"rk:ws:owner:{session_id}:{app_id}"


def _outbox_key(session_id: str, app_id: str) -> str:
    return f"rk:ws:outbox:{session_id}:{app_id}"


def _tool_result_key(session_id: str, app_id: str, call_id: str) -> str:
    return f"rk:ws:tool_result:{session_id}:{app_id}:{call_id}"


async def claim_or_get_owner(session_id: str, app_id: str, instance_id: str, ttl_seconds: int) -> str:
    redis = await _get_redis()
    if redis is None:
        return instance_id

    key = _owner_key(session_id, app_id)
    if await redis.set(key, instance_id, ex=ttl_seconds, nx=True):
        return instance_id

    owner = await redis.get(key)
    if owner == instance_id:
        await redis.expire(key, ttl_seconds)
        return instance_id
    return owner or instance_id


async def refresh_owner(session_id: str, app_id: str, instance_id: str, ttl_seconds: int) -> None:
    redis = await _get_redis()
    if redis is None:
        return
    key = _owner_key(session_id, app_id)
    owner = await redis.get(key)
    if owner == instance_id:
        await redis.expire(key, ttl_seconds)


async def push_outbox_frame(session_id: str, app_id: str, frame: dict[str, Any], ttl_seconds: int) -> None:
    redis = await _get_redis()
    if redis is None:
        return
    key = _outbox_key(session_id, app_id)
    await redis.rpush(key, json.dumps(frame))
    await redis.expire(key, ttl_seconds)


async def pop_outbox_frames(session_id: str, app_id: str, max_items: int = 64) -> list[dict[str, Any]]:
    redis = await _get_redis()
    if redis is None:
        return []
    key = _outbox_key(session_id, app_id)
    frames: list[dict[str, Any]] = []
    for _ in range(max_items):
        item = await redis.lpop(key)
        if item is None:
            break
        try:
            decoded = json.loads(item)
        except Exception:
            continue
        if isinstance(decoded, dict):
            frames.append(decoded)
    return frames


async def store_tool_result(
    session_id: str,
    app_id: str,
    call_id: str,
    payload: dict[str, Any],
    ttl_seconds: int,
) -> None:
    redis = await _get_redis()
    if redis is None:
        return
    key = _tool_result_key(session_id, app_id, call_id)
    await redis.set(key, json.dumps(payload), ex=ttl_seconds)


async def pop_tool_result(session_id: str, app_id: str, call_id: str) -> dict[str, Any] | None:
    redis = await _get_redis()
    if redis is None:
        return None
    key = _tool_result_key(session_id, app_id, call_id)
    item = await redis.get(key)
    if item is None:
        return None
    await redis.delete(key)
    try:
        decoded = json.loads(item)
    except Exception:
        return None
    return decoded if isinstance(decoded, dict) else None
