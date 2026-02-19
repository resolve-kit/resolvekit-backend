import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class DeveloperSignup(BaseModel):
    email: EmailStr
    name: str
    password: str


class DeveloperLogin(BaseModel):
    email: EmailStr
    password: str


class DeveloperOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
