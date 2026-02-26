import pytest
from pydantic import ValidationError

from agent.schemas.developer import (
    MIN_PASSWORD_LENGTH,
    PASSWORD_REQUIREMENT_GUIDANCE,
    DeveloperSignup,
)


def test_signup_rejects_weak_password() -> None:
    with pytest.raises(ValidationError) as exc_info:
        DeveloperSignup(
            email="dev@example.com",
            name="Dev",
            password="weakpass",
            organization_name="Acme",
        )

    assert "Password does not meet requirements" in str(exc_info.value)


def test_signup_accepts_strong_password() -> None:
    signup = DeveloperSignup(
        email="dev@example.com",
        name="Dev Name",
        password="ValidPass1!",
        organization_name="Acme",
        organization_public_id="Acme-Team",
    )

    assert signup.email == "dev@example.com"
    assert signup.name == "Dev Name"
    assert signup.organization_public_id == "acme-team"


def test_signup_trims_name() -> None:
    signup = DeveloperSignup(
        email="dev@example.com",
        name="  Dev Name  ",
        password="ValidPass1!",
        organization_name="Acme",
    )

    assert signup.name == "Dev Name"


def test_password_guidance_declares_minimum_length() -> None:
    assert MIN_PASSWORD_LENGTH >= 10
    assert any(str(MIN_PASSWORD_LENGTH) in line for line in PASSWORD_REQUIREMENT_GUIDANCE)


def test_create_org_signup_requires_organization_name() -> None:
    with pytest.raises(ValidationError) as exc_info:
        DeveloperSignup(
            email="dev@example.com",
            name="Dev",
            password="ValidPass1!",
        )

    assert "Organization name is required" in str(exc_info.value)


def test_join_org_signup_requires_join_organization_id() -> None:
    with pytest.raises(ValidationError) as exc_info:
        DeveloperSignup(
            email="dev@example.com",
            name="Dev",
            password="ValidPass1!",
            signup_intent="join_org",
        )

    assert "Organization ID is required to join an organization" in str(exc_info.value)


def test_join_org_signup_normalizes_join_organization_id() -> None:
    signup = DeveloperSignup(
        email="dev@example.com",
        name="Dev",
        password="ValidPass1!",
        signup_intent="join_org",
        join_organization_id="Team-Alpha",
    )

    assert signup.join_organization_id == "team-alpha"
