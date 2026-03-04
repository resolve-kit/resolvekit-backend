import pytest
from pydantic import ValidationError

from agent.schemas.function_registry import FunctionBulkSync
from agent.schemas.session import SessionCreate


def test_session_create_contract_replaces_entitlements_and_capabilities_with_allowlist() -> None:
    fields = SessionCreate.model_fields
    assert "available_function_names" in fields
    assert "entitlements" not in fields
    assert "capabilities" not in fields


def test_function_bulk_sync_rejects_removed_required_capabilities_field() -> None:
    with pytest.raises(ValidationError, match="required_capabilities"):
        FunctionBulkSync.model_validate(
            {
                "functions": [
                    {
                        "name": "capture_photo",
                        "required_capabilities": ["camera"],
                    }
                ]
            }
        )


def test_function_bulk_sync_rejects_removed_required_entitlements_field() -> None:
    with pytest.raises(ValidationError, match="required_entitlements"):
        FunctionBulkSync.model_validate(
            {
                "functions": [
                    {
                        "name": "capture_photo",
                        "required_entitlements": ["pro"],
                    }
                ]
            }
        )
