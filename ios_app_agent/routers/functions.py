import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_app_from_api_key, get_current_developer, require_app_ownership
from ios_app_agent.models.app import App
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.function_registry import RegisteredFunction
from ios_app_agent.schemas.function_registry import FunctionBulkSync, FunctionOut, FunctionUpdate

# SDK endpoints (API key auth)
sdk_router = APIRouter(prefix="/v1/functions", tags=["functions-sdk"])

# Dashboard endpoints (JWT auth)
dashboard_router = APIRouter(prefix="/v1/apps/{app_id}/functions", tags=["functions-dashboard"])


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
            fn.is_active = True
        else:
            fn = RegisteredFunction(
                app_id=app.id,
                name=f.name,
                description=f.description,
                parameters_schema=f.parameters_schema,
                timeout_seconds=f.timeout_seconds,
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


@dashboard_router.get("", response_model=list[FunctionOut])
async def list_functions_dashboard(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    result = await db.execute(select(RegisteredFunction).where(RegisteredFunction.app_id == app_id))
    return result.scalars().all()


@dashboard_router.patch("/{function_id}", response_model=FunctionOut)
async def update_function(
    app_id: uuid.UUID,
    function_id: uuid.UUID,
    body: FunctionUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    fn = await db.get(RegisteredFunction, function_id)
    if not fn or fn.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Function not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(fn, field, value)
    await db.commit()
    await db.refresh(fn)
    return fn


@dashboard_router.delete("/{function_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_function(
    app_id: uuid.UUID,
    function_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    fn = await db.get(RegisteredFunction, function_id)
    if not fn or fn.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Function not found")

    fn.is_active = False
    await db.commit()
