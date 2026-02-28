import hashlib

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.database import get_db
from agent.models.api_key import ApiKey
from agent.models.app import App


async def get_app_from_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> App:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")

    raw_key = auth_header.removeprefix("Bearer ")
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    result = await db.execute(
        select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
    )
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    app = await db.get(App, api_key.app_id)
    if app is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="App not found")
    return app
