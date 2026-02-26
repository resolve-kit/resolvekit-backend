import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.models.function_registry import RegisteredFunction
from agent.models.session import ChatSession
from agent.services.compatibility_service import function_is_eligible


async def get_active_functions(db: AsyncSession, app_id: uuid.UUID) -> list[RegisteredFunction]:
    result = await db.execute(
        select(RegisteredFunction).where(
            RegisteredFunction.app_id == app_id,
            RegisteredFunction.is_active.is_(True),
        )
    )
    return list(result.scalars().all())


async def get_eligible_functions(
    db: AsyncSession,
    app_id: uuid.UUID,
    session: ChatSession,
) -> list[RegisteredFunction]:
    functions = await get_active_functions(db, app_id)
    return [fn for fn in functions if function_is_eligible(fn, session)]


def get_function_timeout(functions: list[RegisteredFunction], name: str) -> int:
    for fn in functions:
        if fn.name == name:
            return fn.timeout_seconds
    return 30


def validate_function_exists(functions: list[RegisteredFunction], name: str) -> bool:
    return any(fn.name == name and fn.is_active for fn in functions)
