import asyncio
from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
import uuid


class EventStreamStore:
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


event_stream_store = EventStreamStore()
