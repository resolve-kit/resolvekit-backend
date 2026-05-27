import logging
import math
import uuid
from typing import Any

from agent.database import async_session_factory
from agent.models.app import App
from agent.models.llm_usage_event import LLMUsageEvent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App → organization_id cache
# ---------------------------------------------------------------------------
# organization_id is immutable for a given app (apps are never moved between
# orgs).  Caching it avoids a DB round-trip on every LLM call.
# The cache is process-local; it resets on restart (acceptable).
# ---------------------------------------------------------------------------
_app_org_cache: dict[uuid.UUID, uuid.UUID] = {}


async def _get_organization_id(db_context: Any, app_id: uuid.UUID) -> uuid.UUID | None:
    """Return organization_id for app_id, using an in-process cache."""
    cached = _app_org_cache.get(app_id)
    if cached is not None:
        return cached

    app = await db_context.get(App, app_id)
    if app is None:
        return None
    _app_org_cache[app_id] = app.organization_id
    return app.organization_id


def estimate_tokens_from_messages(messages: list[dict[str, Any]]) -> int:
    char_count = 0
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            char_count += len(content)
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        char_count += len(text)
    # Coarse but deterministic estimate for providers that do not return usage.
    return max(1, int(math.ceil(char_count / 4.0))) if char_count else 0


async def record_llm_usage_event(
    *,
    app_id: uuid.UUID | None,
    session_id: uuid.UUID | None,
    provider: str,
    model: str,
    operation: str,
    input_tokens: int | None,
    output_tokens: int | None,
    organization_id: uuid.UUID | None = None,
    image_count: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Record an LLM usage event.

    Pass ``organization_id`` when already known to avoid the App DB lookup.
    When omitted, organization_id is resolved via an in-process cache (one DB
    hit per unique app_id per process lifetime, not per LLM call).
    """
    if not app_id:
        return

    async with async_session_factory() as db:
        org_id = organization_id
        if org_id is None:
            org_id = await _get_organization_id(db, app_id)
        if org_id is None:
            logger.debug("record_llm_usage_event_skipped app_id=%s reason=app_not_found", app_id)
            return

        event = LLMUsageEvent(
            organization_id=org_id,
            app_id=app_id,
            session_id=session_id,
            provider=provider,
            model=model,
            operation=operation,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            image_count=image_count,
            metadata_json=metadata or {},
        )
        db.add(event)
        await db.commit()
