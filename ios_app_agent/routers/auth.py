from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.config import settings
from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.models.organization import Organization
from ios_app_agent.schemas.developer import (
    MIN_PASSWORD_LENGTH,
    PASSWORD_REQUIREMENT_GUIDANCE,
    DeveloperLogin,
    DeveloperOut,
    DeveloperSignup,
    PasswordGuidanceOut,
    TokenOut,
)
from ios_app_agent.services.organization_service import (
    default_organization_name,
    normalize_email,
    organization_public_id_from_name,
    random_organization_public_id,
)

router = APIRouter(prefix="/v1/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(developer_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": developer_id, "exp": expire}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def signup(body: DeveloperSignup, db: AsyncSession = Depends(get_db)):
    normalized_email = normalize_email(body.email)
    existing = await db.execute(select(DeveloperAccount).where(DeveloperAccount.email == normalized_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    if body.signup_intent == "join_org":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct organization join is disabled. Ask an organization admin for an invitation.",
        )

    if not body.organization_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Organization name is required")

    requested_public_id = body.organization_public_id or organization_public_id_from_name(body.organization_name)
    existing_org = await db.execute(
        select(Organization).where(Organization.public_id == requested_public_id)
    )
    if existing_org.scalar_one_or_none():
        if body.organization_public_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization ID already in use")

        # When ID is generated from name and collides, retry once with random suffix.
        fallback_public_id = random_organization_public_id(body.organization_name)
        retry_existing_org = await db.execute(
            select(Organization).where(Organization.public_id == fallback_public_id)
        )
        if retry_existing_org.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not generate unique organization ID")
        requested_public_id = fallback_public_id

    organization = Organization(
        name=body.organization_name or default_organization_name(body.name),
        public_id=requested_public_id,
    )
    db.add(organization)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        lowered = str(exc).lower()
        if "organizations" in lowered and "public_id" in lowered:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization ID already in use")
        raise

    developer = DeveloperAccount(
        email=normalized_email,
        name=body.name,
        hashed_password=hash_password(body.password),
        role="owner",
        organization_id=organization.id,
    )
    db.add(developer)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        lowered = str(exc).lower()
        if "organizations" in lowered and "public_id" in lowered:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Organization ID already in use")
        if "developer_accounts" in lowered and "email" in lowered:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        raise
    await db.refresh(developer)

    return TokenOut(access_token=create_access_token(str(developer.id)))


@router.post("/login", response_model=TokenOut)
async def login(body: DeveloperLogin, db: AsyncSession = Depends(get_db)):
    normalized_email = normalize_email(body.email)
    result = await db.execute(select(DeveloperAccount).where(DeveloperAccount.email == normalized_email))
    developer = result.scalar_one_or_none()
    if not developer or not verify_password(body.password, developer.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return TokenOut(access_token=create_access_token(str(developer.id)))


@router.get("/me", response_model=DeveloperOut)
async def me(developer: DeveloperAccount = Depends(get_current_developer)):
    return developer


@router.get("/password-guidance", response_model=PasswordGuidanceOut)
async def password_guidance():
    return PasswordGuidanceOut(
        minimum_length=MIN_PASSWORD_LENGTH,
        requirements=PASSWORD_REQUIREMENT_GUIDANCE,
    )
