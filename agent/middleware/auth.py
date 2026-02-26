import hashlib
import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.config import settings
from agent.database import get_db
from agent.models.api_key import ApiKey
from agent.models.app import App
from agent.models.developer import DeveloperAccount

bearer_scheme = HTTPBearer()


async def get_current_developer(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> DeveloperAccount:
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        developer_id = payload.get("sub")
        if developer_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    developer = await db.get(DeveloperAccount, uuid.UUID(developer_id))
    if developer is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Developer not found")
    return developer


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


def require_app_ownership(developer: DeveloperAccount, app_id: uuid.UUID, db_app: App) -> None:
    if developer.organization_id is None or db_app.organization_id != developer.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
