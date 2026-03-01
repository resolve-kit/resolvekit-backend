from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from knowledge_bases.models import LLMUsageEvent


def estimate_tokens_from_text(text: str) -> int:
    if not text:
        return 0
    return max(1, int(math.ceil(len(text) / 4.0)))


def usage_tokens_from_litellm_response(response: Any) -> tuple[int | None, int | None]:
    if not isinstance(response, dict):
        return None, None
    usage = response.get("usage")
    if not isinstance(usage, dict):
        return None, None

    prompt_tokens = usage.get("prompt_tokens")
    completion_tokens = usage.get("completion_tokens")
    try:
        parsed_prompt = int(prompt_tokens) if prompt_tokens is not None else None
    except (TypeError, ValueError):
        parsed_prompt = None
    try:
        parsed_completion = int(completion_tokens) if completion_tokens is not None else None
    except (TypeError, ValueError):
        parsed_completion = None
    return parsed_prompt, parsed_completion


async def record_usage_event(
    db: AsyncSession,
    *,
    organization_id: uuid.UUID,
    provider: str,
    model: str,
    operation: str,
    knowledge_base_id: uuid.UUID | None = None,
    app_id: uuid.UUID | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    image_count: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    event = LLMUsageEvent(
        organization_id=organization_id,
        knowledge_base_id=knowledge_base_id,
        app_id=app_id,
        provider=provider.strip().lower(),
        model=model.strip(),
        operation=operation.strip().lower(),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        image_count=image_count,
        metadata_json=metadata or {},
    )
    db.add(event)
