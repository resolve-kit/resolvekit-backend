from fastapi import HTTPException, status

from agent.models.developer import DeveloperAccount

ORG_ROLE_OWNER = "owner"
ORG_ROLE_ADMIN = "admin"
ORG_ROLE_MEMBER = "member"
ORG_ROLES = {ORG_ROLE_OWNER, ORG_ROLE_ADMIN, ORG_ROLE_MEMBER}
ORG_ADMIN_ROLES = {ORG_ROLE_OWNER, ORG_ROLE_ADMIN}


def require_org_role(developer: DeveloperAccount, allowed_roles: set[str]) -> None:
    if developer.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient organization permissions",
        )
