from pathlib import Path


def test_message_sequence_number_field_maps_to_snake_case_column() -> None:
    text = Path("dashboard/prisma/schema.prisma").read_text(encoding="utf-8")
    assert 'sequenceNumber Int     @map("sequence_number")' in text


def test_prisma_schema_uses_session_function_allowlist_and_drops_legacy_gates() -> None:
    text = Path("dashboard/prisma/schema.prisma").read_text(encoding="utf-8")
    assert "availableFunctionNames Json   @default(\"[]\") @map(\"available_function_names\")" in text
    assert "requiredEntitlements" not in text
    assert "requiredCapabilities" not in text
    assert " entitlements  Json" not in text
    assert " capabilities  Json" not in text
