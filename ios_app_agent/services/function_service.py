import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.models.function_registry import RegisteredFunction


async def get_active_functions(db: AsyncSession, app_id: uuid.UUID) -> list[RegisteredFunction]:
    result = await db.execute(
        select(RegisteredFunction).where(
            RegisteredFunction.app_id == app_id,
            RegisteredFunction.is_active.is_(True),
        )
    )
    return list(result.scalars().all())


def get_function_timeout(functions: list[RegisteredFunction], name: str) -> int:
    for fn in functions:
        if fn.name == name:
            return fn.timeout_seconds
    return 30


def validate_function_exists(functions: list[RegisteredFunction], name: str) -> bool:
    return any(fn.name == name and fn.is_active for fn in functions)
