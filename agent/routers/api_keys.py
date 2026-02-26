import hashlib
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.database import get_db
from agent.middleware.auth import get_current_developer, require_app_ownership
from agent.models.api_key import ApiKey
from agent.models.app import App
from agent.models.developer import DeveloperAccount
from agent.schemas.app import ApiKeyCreate, ApiKeyCreated, ApiKeyOut
from agent.services.audit_service import AuditService

router = APIRouter(prefix="/v1/apps/{app_id}/api-keys", tags=["api-keys"])


@router.post("", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    app_id: uuid.UUID,
    body: ApiKeyCreate,
    request: Request,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    raw_key = "iaa_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:8]

    api_key = ApiKey(app_id=app_id, key_hash=key_hash, key_prefix=key_prefix, label=body.label)
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    await AuditService.emit(
        db=db,
        app_id=app_id,
        actor_email=developer.email,
        event_type="apikey.created",
        entity_id=str(api_key.id),
        entity_name=body.label or api_key.key_prefix,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    return ApiKeyCreated(
        id=api_key.id,
        key_prefix=api_key.key_prefix,
        label=api_key.label,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        raw_key=raw_key,
    )


@router.get("", response_model=list[ApiKeyOut])
async def list_api_keys(
    app_id: uuid.UUID,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    result = await db.execute(select(ApiKey).where(ApiKey.app_id == app_id).order_by(ApiKey.created_at.desc()))
    return result.scalars().all()


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    app_id: uuid.UUID,
    key_id: uuid.UUID,
    request: Request,
    developer: DeveloperAccount = Depends(get_current_developer),
    db: AsyncSession = Depends(get_db),
):
    app = await db.get(App, app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    require_app_ownership(developer, app_id, app)

    api_key = await db.get(ApiKey, key_id)
    if not api_key or api_key.app_id != app_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    api_key.is_active = False
    await AuditService.emit(
        db=db,
        app_id=app_id,
        actor_email=developer.email,
        event_type="apikey.revoked",
        entity_id=str(key_id),
        entity_name=api_key.label or api_key.key_prefix,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
