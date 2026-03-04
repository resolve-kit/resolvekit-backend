import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.database import get_db
from agent.middleware.auth import get_app_from_api_key
from agent.models.app import App
from agent.models.function_registry import RegisteredFunction
from agent.models.session import ChatSession
from agent.schemas.function_registry import FunctionBulkSync, FunctionOut
from agent.services.function_service import get_eligible_functions

# SDK endpoints (API key auth)
sdk_router = APIRouter(prefix="/v1/functions", tags=["functions-sdk"])


@sdk_router.put("/bulk", response_model=list[FunctionOut])
async def bulk_sync_functions(
    body: FunctionBulkSync,
    app: App = Depends(get_app_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RegisteredFunction).where(RegisteredFunction.app_id == app.id))
    existing = {fn.name: fn for fn in result.scalars().all()}
    incoming_names = {f.name for f in body.functions}

    # Deactivate functions not in the incoming list
    for name, fn in existing.items():
        if name not in incoming_names:
            fn.is_active = False

    # Upsert incoming functions
    output = []
    for f in body.functions:
        if f.name in existing:
            fn = existing[f.name]
            fn.description = f.description
            fn.parameters_schema = f.parameters_schema
            fn.timeout_seconds = f.timeout_seconds
            fn.availability = f.availability
            fn.source = f.source
            fn.pack_name = f.pack_name
            fn.requires_approval = f.requires_approval
            fn.is_active = True
        else:
            fn = RegisteredFunction(
                app_id=app.id,
                name=f.name,
                description=f.description,
                parameters_schema=f.parameters_schema,
                timeout_seconds=f.timeout_seconds,
                availability=f.availability,
                source=f.source,
                pack_name=f.pack_name,
                requires_approval=f.requires_approval,
            )
            db.add(fn)
        output.append(fn)

    await db.commit()
    for fn in output:
        await db.refresh(fn)
    return output


@sdk_router.get("", response_model=list[FunctionOut])
async def list_functions_sdk(
    app: App = Depends(get_app_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RegisteredFunction).where(RegisteredFunction.app_id == app.id, RegisteredFunction.is_active.is_(True))
    )
    return result.scalars().all()


@sdk_router.get("/eligible", response_model=list[FunctionOut])
async def list_eligible_functions_sdk(
    session_id: uuid.UUID,
    app: App = Depends(get_app_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(ChatSession, session_id)
    if not session or session.app_id != app.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return await get_eligible_functions(db, app.id, session)
