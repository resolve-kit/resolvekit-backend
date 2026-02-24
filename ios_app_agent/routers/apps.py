import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer, require_app_ownership
from ios_app_agent.models.app import App
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.schemas.app import AppCreate, AppOut, AppUpdate
from ios_app_agent.services.organization_service import ensure_developer_organization

router = APIRouter(prefix="/v1/apps", tags=["apps"])


@router.post("", response_model=AppOut, status_code=status.HTTP_201_CREATED)
async def create_app(
    body: AppCreate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    await ensure_developer_organization(db, developer)
    app = App(
        developer_id=developer.id,
        organization_id=developer.organization_id,
        name=body.name,
        bundle_id=body.bundle_id,
    )
    db.add(app)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="App name already exists")
    await db.refresh(app)
    return app


@router.get("", response_model=list[AppOut])
async def list_apps(
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    if developer.organization_id is None:
        return []

    result = await db.execute(
        select(App).where(App.organization_id == developer.organization_id).order_by(App.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{app_id}", response_model=AppOut)
async def get_app(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)
    return app


@router.patch("/{app_id}", response_model=AppOut)
async def update_app(
    app_id: uuid.UUID,
    body: AppUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    if body.name is not None:
        app.name = body.name
    if body.bundle_id is not None:
        app.bundle_id = body.bundle_id
    if body.integration_enabled is not None and body.integration_enabled != app.integration_enabled:
        app.integration_enabled = body.integration_enabled
        app.integration_version += 1
    await db.commit()
    await db.refresh(app)
    return app


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_app(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)
    await db.delete(app)
    await db.commit()
