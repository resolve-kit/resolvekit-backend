from pathlib import Path


def test_message_sequence_number_field_maps_to_snake_case_column() -> None:
    text = Path("dashboard/prisma/schema.prisma").read_text(encoding="utf-8")
    assert 'sequenceNumber Int     @map("sequence_number")' in text
