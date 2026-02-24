import uuid
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from kb_service.config import settings

bearer_scheme = HTTPBearer()


@dataclass
class ServicePrincipal:
    organization_id: uuid.UUID
    actor_id: str
    actor_role: str


async def get_service_principal(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ServicePrincipal:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.service_jwt_signing_key,
            algorithms=[settings.service_jwt_algorithm],
            audience=settings.service_jwt_audience,
        )
        org_id_raw = payload.get("org_id")
        actor_id = payload.get("actor_id")
        actor_role = payload.get("actor_role")
        if not isinstance(org_id_raw, str) or not isinstance(actor_id, str) or not isinstance(actor_role, str):
            raise ValueError("Invalid service token claims")
        organization_id = uuid.UUID(org_id_raw)
    except (JWTError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service token") from exc

    return ServicePrincipal(
        organization_id=organization_id,
        actor_id=actor_id,
        actor_role=actor_role,
    )
