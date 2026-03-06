import asyncio
from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone
import inspect
import json
from typing import Any, Awaitable, Callable
import uuid

from agent.config import settings
from agent.services.runtime_redis_service import get_redis_client, redis_enabled

_MIN_EVENT_STREAM_TTL_SECONDS = 3600


class _InMemoryEventStreamStore:
    def __init__(self) -> None:
        self._events: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        self._conditions: dict[tuple[str, str], asyncio.Condition] = {}
        self._lock = asyncio.Lock()

    async def append(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        turn_id: str,
        request_id: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        key = self._key(session_id, app_id)
        async with self._lock:
            bucket = self._events[key]
            event = {
                "event_id": str(len(bucket) + 1),
                "turn_id": turn_id,
                "request_id": request_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "type": event_type,
                "payload": deepcopy(payload),
            }
            bucket.append(event)
            condition = self._conditions.setdefault(key, asyncio.Condition())

        async with condition:
            condition.notify_all()
        return deepcopy(event)

    async def replay(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        after_event_id: str | None,
    ) -> list[dict[str, Any]]:
        key = self._key(session_id, app_id)
        async with self._lock:
            bucket = list(self._events.get(key, []))
        return [deepcopy(event) for event in bucket if self._is_after(event["event_id"], after_event_id)]

    async def wait_for_events(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        after_event_id: str | None,
        timeout: float,
    ) -> list[dict[str, Any]]:
        replay = await self.replay(session_id=session_id, app_id=app_id, after_event_id=after_event_id)
        if replay:
            return replay

        key = self._key(session_id, app_id)
        condition = self._conditions.setdefault(key, asyncio.Condition())
        async with condition:
            await asyncio.wait_for(condition.wait(), timeout=timeout)
        return await self.replay(session_id=session_id, app_id=app_id, after_event_id=after_event_id)

    @staticmethod
    def _key(session_id: uuid.UUID, app_id: uuid.UUID) -> tuple[str, str]:
        return str(session_id), str(app_id)

    @staticmethod
    def _is_after(event_id: str, after_event_id: str | None) -> bool:
        if after_event_id is None:
            return True
        try:
            return int(event_id) > int(after_event_id)
        except ValueError:
            return event_id > after_event_id


class EventStreamStore:
    def __init__(
        self,
        *,
        redis_client_factory: Callable[[], Awaitable[Any] | Any] | None = None,
        redis_enabled_override: bool | None = None,
    ) -> None:
        self._redis_client_factory = redis_client_factory or get_redis_client
        self._redis_enabled_override = redis_enabled_override
        self._memory_store = _InMemoryEventStreamStore()

    async def append(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        turn_id: str,
        request_id: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        redis = await self._get_required_redis()
        if redis is None:
            return await self._memory_store.append(
                session_id=session_id,
                app_id=app_id,
                turn_id=turn_id,
                request_id=request_id,
                event_type=event_type,
                payload=payload,
            )

        event = self._build_event(
            turn_id=turn_id,
            request_id=request_id,
            event_type=event_type,
            payload=payload,
        )
        event_id = await redis.xadd(
            self._stream_key(session_id=session_id, app_id=app_id),
            {
                "turn_id": event["turn_id"],
                "request_id": event["request_id"],
                "timestamp": event["timestamp"],
                "type": event["type"],
                "payload": json.dumps(event["payload"]),
            },
        )
        await redis.expire(self._stream_key(session_id=session_id, app_id=app_id), self._ttl_seconds())
        return {
            "event_id": str(event_id),
            **event,
        }

    async def replay(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        after_event_id: str | None,
    ) -> list[dict[str, Any]]:
        redis = await self._get_required_redis()
        if redis is None:
            return await self._memory_store.replay(
                session_id=session_id,
                app_id=app_id,
                after_event_id=after_event_id,
            )

        key = self._stream_key(session_id=session_id, app_id=app_id)
        min_id = f"({after_event_id}" if after_event_id is not None else "-"
        entries = await redis.xrange(key, min=min_id, max="+")
        return [self._decode_redis_entry(event_id, fields) for event_id, fields in entries]

    async def wait_for_events(
        self,
        *,
        session_id: uuid.UUID,
        app_id: uuid.UUID,
        after_event_id: str | None,
        timeout: float,
    ) -> list[dict[str, Any]]:
        redis = await self._get_required_redis()
        if redis is None:
            return await self._memory_store.wait_for_events(
                session_id=session_id,
                app_id=app_id,
                after_event_id=after_event_id,
                timeout=timeout,
            )

        replay = await self.replay(session_id=session_id, app_id=app_id, after_event_id=after_event_id)
        if replay:
            return replay

        key = self._stream_key(session_id=session_id, app_id=app_id)
        start_id = after_event_id or await self._latest_event_id(redis, key) or "$"
        try:
            result = await redis.xread({key: start_id}, block=max(1, int(timeout * 1000)))
        except TimeoutError:
            return []
        if not result:
            return []

        entries = result[0][1]
        return [self._decode_redis_entry(event_id, fields) for event_id, fields in entries]

    async def _get_required_redis(self) -> Any | None:
        if not self._redis_enabled():
            return None
        redis = self._redis_client_factory()
        if inspect.isawaitable(redis):
            redis = await redis
        if redis is None:
            raise RuntimeError("Redis-backed event stream is unavailable")
        return redis

    def _redis_enabled(self) -> bool:
        if self._redis_enabled_override is not None:
            return self._redis_enabled_override
        return redis_enabled()

    async def _latest_event_id(self, redis: Any, key: str) -> str | None:
        latest = await redis.xrevrange(key, max="+", min="-", count=1)
        if not latest:
            return None
        return str(latest[0][0])

    @staticmethod
    def _decode_redis_entry(event_id: str, fields: dict[str, Any]) -> dict[str, Any]:
        payload = fields.get("payload", "{}")
        if isinstance(payload, bytes):
            payload = payload.decode("utf-8")
        try:
            decoded_payload = json.loads(payload)
        except Exception:
            decoded_payload = {}

        return {
            "event_id": str(event_id),
            "turn_id": str(fields.get("turn_id", "")),
            "request_id": str(fields.get("request_id", "")),
            "timestamp": str(fields.get("timestamp", "")),
            "type": str(fields.get("type", "")),
            "payload": decoded_payload if isinstance(decoded_payload, dict) else {},
        }

    @staticmethod
    def _build_event(
        *,
        turn_id: str,
        request_id: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "turn_id": turn_id,
            "request_id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": event_type,
            "payload": deepcopy(payload),
        }

    @staticmethod
    def _stream_key(*, session_id: uuid.UUID, app_id: uuid.UUID) -> str:
        return f"rk:events:{app_id}:{session_id}"

    @staticmethod
    def _ttl_seconds() -> int:
        return max(int(settings.session_ttl_minutes * 60), _MIN_EVENT_STREAM_TTL_SECONDS)


event_stream_store = EventStreamStore()
