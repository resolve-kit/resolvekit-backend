import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.organization import Organization

ORGANIZATION_PUBLIC_ID_MIN_LENGTH = 3
ORGANIZATION_PUBLIC_ID_MAX_LENGTH = 32
ORGANIZATION_PUBLIC_ID_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def default_organization_name(developer_name: str) -> str:
    normalized = developer_name.strip()
    if normalized:
        return f"{normalized}'s Organization"
    return "My Organization"


def normalize_organization_public_id(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    return normalized


def validate_organization_public_id(value: str) -> str:
    normalized = normalize_organization_public_id(value)
    if len(normalized) < ORGANIZATION_PUBLIC_ID_MIN_LENGTH:
        raise ValueError(
            f"Organization ID must be at least {ORGANIZATION_PUBLIC_ID_MIN_LENGTH} characters"
        )
    if len(normalized) > ORGANIZATION_PUBLIC_ID_MAX_LENGTH:
        raise ValueError(
            f"Organization ID must be at most {ORGANIZATION_PUBLIC_ID_MAX_LENGTH} characters"
        )
    if not ORGANIZATION_PUBLIC_ID_PATTERN.match(normalized):
        raise ValueError("Organization ID may only contain lowercase letters, numbers, and hyphens")
    return normalized


def organization_public_id_from_name(name: str) -> str:
    candidate = normalize_organization_public_id(name)
    if len(candidate) < ORGANIZATION_PUBLIC_ID_MIN_LENGTH:
        return "org"
    return candidate[:ORGANIZATION_PUBLIC_ID_MAX_LENGTH].strip("-") or "org"


def random_organization_public_id(base_name: str) -> str:
    base = organization_public_id_from_name(base_name)
    suffix = uuid.uuid4().hex[:6]
    trimmed = base[: max(ORGANIZATION_PUBLIC_ID_MIN_LENGTH, ORGANIZATION_PUBLIC_ID_MAX_LENGTH - len(suffix) - 1)]
    trimmed = trimmed.strip("-") or "org"
    return f"{trimmed}-{suffix}"


async def ensure_developer_organization(db: AsyncSession, developer: DeveloperAccount) -> Organization:
    if developer.organization_id:
        org = await db.get(Organization, developer.organization_id)
        if org:
            return org

    organization = Organization(
        name=default_organization_name(developer.name),
        public_id=random_organization_public_id(developer.name),
    )
    db.add(organization)
    await db.flush()
    developer.organization_id = organization.id
    developer.role = "owner"
    await db.flush()
    return organization
