import math
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from agent.database import async_session_factory
from agent.models.app import App
from agent.models.llm_usage_event import LLMUsageEvent


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
    image_count: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    if not app_id:
        return

    async with async_session_factory() as db:
        await _record_usage_with_session(
            db,
            app_id=app_id,
            session_id=session_id,
            provider=provider,
            model=model,
            operation=operation,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            image_count=image_count,
            metadata=metadata or {},
        )


async def _record_usage_with_session(
    db: AsyncSession,
    *,
    app_id: uuid.UUID,
    session_id: uuid.UUID | None,
    provider: str,
    model: str,
    operation: str,
    input_tokens: int | None,
    output_tokens: int | None,
    image_count: int | None,
    metadata: dict[str, Any],
) -> None:
    app = await db.get(App, app_id)
    if app is None:
        return

    event = LLMUsageEvent(
        organization_id=app.organization_id,
        app_id=app_id,
        session_id=session_id,
        provider=provider,
        model=model,
        operation=operation,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        image_count=image_count,
        metadata_json=metadata,
    )
    db.add(event)
    await db.commit()
