from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt import InvalidTokenError

from agent.config import settings

bearer_scheme = HTTPBearer()


async def require_internal_service(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> None:
    """Validates a service-to-service JWT issued by the dashboard `api`, mirroring
    the knowledge_bases service's own internal-auth pattern."""
    try:
        jwt.decode(
            credentials.credentials,
            settings.internal_service_signing_key,
            algorithms=[settings.internal_service_jwt_algorithm],
            audience=settings.internal_service_audience,
        )
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service token") from exc
