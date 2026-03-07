import asyncio
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


