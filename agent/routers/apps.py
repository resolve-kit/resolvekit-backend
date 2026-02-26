import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.database import get_db
from agent.middleware.auth import get_current_developer, require_app_ownership
from agent.models.app import App
from agent.models.developer import DeveloperAccount
from agent.schemas.app import (
    AppCreate,
    AppOut,
    AppUpdate,
    ChatLocalizationsOut,
    ChatLocalizationsUpdate,
)
from agent.schemas.chat_theme import ChatThemeOut, ChatThemeUpdate
from agent.services.chat_localization_service import build_catalog_response, sanitize_overrides_for_storage
from agent.services.chat_theme_service import default_chat_theme, normalize_chat_theme
from agent.services.organization_service import ensure_developer_organization

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


@router.get("/{app_id}/chat-localizations", response_model=ChatLocalizationsOut)
async def get_chat_localizations(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)
    return ChatLocalizationsOut(locales=build_catalog_response(app))


@router.put("/{app_id}/chat-localizations", response_model=ChatLocalizationsOut)
async def update_chat_localizations(
    app_id: uuid.UUID,
    body: ChatLocalizationsUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)
    app.chat_localization_overrides = sanitize_overrides_for_storage(body.overrides)
    await db.commit()
    await db.refresh(app)
    return ChatLocalizationsOut(locales=build_catalog_response(app))


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


@router.get("/{app_id}/chat-theme", response_model=ChatThemeOut)
async def get_chat_theme(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    raw_theme = app.chat_theme or default_chat_theme()
    normalized = normalize_chat_theme(raw_theme)
    if normalized != raw_theme:
        app.chat_theme = normalized
        await db.commit()
    return ChatThemeOut(**normalized)


@router.put("/{app_id}/chat-theme", response_model=ChatThemeOut)
async def update_chat_theme(
    app_id: uuid.UUID,
    body: ChatThemeUpdate,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    normalized = normalize_chat_theme(body.model_dump())
    app.chat_theme = normalized
    await db.commit()
    return ChatThemeOut(**normalized)
