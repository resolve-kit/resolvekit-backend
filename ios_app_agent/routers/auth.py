from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ios_app_agent.config import settings
from ios_app_agent.database import get_db
from ios_app_agent.middleware.auth import get_current_developer
from ios_app_agent.models.developer import DeveloperAccount
from ios_app_agent.schemas.developer import DeveloperLogin, DeveloperOut, DeveloperSignup, TokenOut

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
    existing = await db.execute(select(DeveloperAccount).where(DeveloperAccount.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    developer = DeveloperAccount(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
    )
    db.add(developer)
    await db.commit()
    await db.refresh(developer)

    return TokenOut(access_token=create_access_token(str(developer.id)))


@router.post("/login", response_model=TokenOut)
async def login(body: DeveloperLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DeveloperAccount).where(DeveloperAccount.email == body.email))
    developer = result.scalar_one_or_none()
    if not developer or not verify_password(body.password, developer.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return TokenOut(access_token=create_access_token(str(developer.id)))


@router.get("/me", response_model=DeveloperOut)
async def me(developer: DeveloperAccount = Depends(get_current_developer)):
    return developer
