import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from agent.services.runtime_redis_service import get_redis_client, redis_enabled

logger = logging.getLogger(__name__)


class TurnStateStore:
    """Persists turn metadata to Redis for cross-process consistency.

    Falls back to in-memory storage when Redis is unavailable.
    """

    def __init__(self) -> None:
        self._memory_turns: dict[tuple[str, str], dict[str, Any]] = {}
        self._memory_locks: dict[tuple[str, str], str] = {}
        self._memory_request_map: dict[tuple[str, str, str], str] = {}
        self._memory_dedup: dict[tuple[str, str], set[str]] = {}

    async def try_start_turn(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        request_id: str,
        turn_id: str,
        ttl_seconds: int = 600,
    ) -> tuple[str, bool]:
        """Returns (turn_id, is_new).

        - request_id already mapped -> returns (existing_turn_id, False)
        - Another turn active -> raises HTTPException(409)
        - Otherwise -> acquires lock, stores metadata, returns (turn_id, True)
        """
        redis = await get_redis_client()
        if redis is None or not redis_enabled():
            return await self._try_start_turn_memory(
                session_id=session_id,
                app_id=app_id,
                request_id=request_id,
                turn_id=turn_id,
            )

        sid, aid = str(session_id), str(app_id)

        # 1. Check idempotency
        req_key = f"rk:turn_req:{aid}:{sid}:{request_id}"
        existing = await redis.get(req_key)
        if existing is not None:
            return str(existing), False

        # 2. Try to acquire turn lock
        lock_key = f"rk:turn:lock:{aid}:{sid}"
        acquired = await redis.set(lock_key, turn_id, ex=ttl_seconds, nx=True)
        if not acquired:
            current_holder = await redis.get(lock_key)
            if current_holder != turn_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A turn is already in progress",
                )

        # 3. Store turn metadata
        meta_key = f"rk:turn:{aid}:{sid}"
        await redis.hset(meta_key, mapping={
            "turn_id": turn_id,
            "request_id": request_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
        })
        await redis.expire(meta_key, ttl_seconds)

        # 4. Store idempotency mapping
        await redis.set(req_key, turn_id, ex=ttl_seconds)

        return turn_id, True

    async def clear_turn(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        turn_id: str,
    ) -> None:
        """Release lock + delete metadata."""
        redis = await get_redis_client()
        if redis is None or not redis_enabled():
            self._clear_turn_memory(session_id=session_id, app_id=app_id, turn_id=turn_id)
            return

        sid, aid = str(session_id), str(app_id)
        lock_key = f"rk:turn:lock:{aid}:{sid}"
        meta_key = f"rk:turn:{aid}:{sid}"

        # Only release if we own the lock
        current = await redis.get(lock_key)
        if current == turn_id:
            await redis.delete(lock_key)
        await redis.delete(meta_key)

    async def check_and_add_dedup_key(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        key: str,
    ) -> bool:
        """Returns True if key was already present (duplicate)."""
        redis = await get_redis_client()
        if redis is None or not redis_enabled():
            return self._check_and_add_dedup_memory(
                session_id=session_id, app_id=app_id, key=key
            )

        sid, aid = str(session_id), str(app_id)
        dedup_key = f"rk:turn_dedup:{aid}:{sid}"
        already_present = await redis.sismember(dedup_key, key)
        if not already_present:
            await redis.sadd(dedup_key, key)
            await redis.expire(dedup_key, 600)
        return bool(already_present)

    async def has_active_turn(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
    ) -> bool:
        """Check if there's an active turn (used by tool result delivery)."""
        redis = await get_redis_client()
        if redis is None or not redis_enabled():
            key = (str(session_id), str(app_id))
            return key in self._memory_locks

        sid, aid = str(session_id), str(app_id)
        lock_key = f"rk:turn:lock:{aid}:{sid}"
        return await redis.exists(lock_key) > 0

    # --- In-memory fallback ---

    async def _try_start_turn_memory(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        request_id: str,
        turn_id: str,
    ) -> tuple[str, bool]:
        key = (str(session_id), str(app_id))
        req_map_key = (str(session_id), str(app_id), request_id)

        existing = self._memory_request_map.get(req_map_key)
        if existing is not None:
            return existing, False

        if key in self._memory_locks:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A turn is already in progress",
            )

        self._memory_locks[key] = turn_id
        self._memory_turns[key] = {
            "turn_id": turn_id,
            "request_id": request_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        self._memory_request_map[req_map_key] = turn_id
        return turn_id, True

    def _clear_turn_memory(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        turn_id: str,
    ) -> None:
        key = (str(session_id), str(app_id))
        if self._memory_locks.get(key) == turn_id:
            self._memory_locks.pop(key, None)
        self._memory_turns.pop(key, None)
        self._memory_dedup.pop(key, None)

    def _check_and_add_dedup_memory(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        key: str,
    ) -> bool:
        mem_key = (str(session_id), str(app_id))
        dedup_set = self._memory_dedup.setdefault(mem_key, set())
        if key in dedup_set:
            return True
        dedup_set.add(key)
        return False


turn_state_store = TurnStateStore()
