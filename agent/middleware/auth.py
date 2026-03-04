import hashlib

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.database import get_db
from agent.models.api_key import ApiKey
from agent.models.app import App
from agent.services.sdk_client_token_service import resolve_sdk_client_token_app_id


def _resolve_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization token")
    return auth_header.removeprefix("Bearer ").strip()


async def _lookup_app_by_api_key(db: AsyncSession, raw_key: str) -> App | None:
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        return None

    return await db.get(App, api_key.app_id)


async def get_app_from_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> App:
    raw_key = _resolve_bearer_token(request)
    app = await _lookup_app_by_api_key(db, raw_key)
    if app is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return app


async def get_app_from_sdk_auth(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> App:
    raw_token = _resolve_bearer_token(request)

    app = await _lookup_app_by_api_key(db, raw_token)
    if app is not None:
        return app

    app_id = resolve_sdk_client_token_app_id(raw_token)
    app = await db.get(App, app_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid client token")

    resolve_sdk_client_token_app_id(raw_token, app=app)
    return app
