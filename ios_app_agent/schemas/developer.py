import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, field_validator, model_validator

from ios_app_agent.services.organization_service import (
    organization_public_id_from_name,
    validate_organization_public_id,
)

MIN_PASSWORD_LENGTH = 10
PASSWORD_REQUIREMENT_GUIDANCE = [
    f"At least {MIN_PASSWORD_LENGTH} characters",
    "At least one uppercase letter",
    "At least one lowercase letter",
    "At least one number",
    "At least one special character",
    "No whitespace characters",
]


def password_requirement_failures(password: str) -> list[str]:
    failures: list[str] = []

    if len(password) < MIN_PASSWORD_LENGTH:
        failures.append(f"must be at least {MIN_PASSWORD_LENGTH} characters")
    if not any(char.isupper() for char in password):
        failures.append("must include an uppercase letter")
    if not any(char.islower() for char in password):
        failures.append("must include a lowercase letter")
    if not any(char.isdigit() for char in password):
        failures.append("must include a number")
    if not any(not char.isalnum() for char in password):
        failures.append("must include a special character")
    if any(char.isspace() for char in password):
        failures.append("must not include whitespace")

    return failures


class DeveloperSignup(BaseModel):
    email: EmailStr
    name: str
    password: str
    signup_intent: Literal["create_org", "join_org"] = "create_org"
    organization_name: str | None = None
    organization_public_id: str | None = None
    join_organization_id: str | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Name must be at least 2 characters")
        if len(normalized) > 255:
            raise ValueError("Name must be 255 characters or fewer")
        return normalized

    @field_validator("organization_name")
    @classmethod
    def validate_organization_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Organization name must be at least 2 characters")
        if len(normalized) > 255:
            raise ValueError("Organization name must be 255 characters or fewer")
        return normalized

    @field_validator("organization_public_id")
    @classmethod
    def validate_organization_public_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_organization_public_id(value)

    @field_validator("join_organization_id")
    @classmethod
    def validate_join_organization_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_organization_public_id(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        failures = password_requirement_failures(value)
        if failures:
            joined = "; ".join(failures)
            raise ValueError(f"Password does not meet requirements: {joined}")
        return value

    @model_validator(mode="after")
    def validate_signup_intent_fields(self) -> "DeveloperSignup":
        if self.signup_intent == "create_org":
            if not self.organization_name:
                raise ValueError("Organization name is required when registering an organization")
            if not self.organization_public_id:
                self.organization_public_id = organization_public_id_from_name(self.organization_name)

        if self.signup_intent == "join_org" and not self.join_organization_id:
            raise ValueError("Organization ID is required to join an organization")

        return self


class DeveloperLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class DeveloperOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: str
    organization_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordGuidanceOut(BaseModel):
    minimum_length: int
    requirements: list[str]
