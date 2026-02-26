"""legacy placeholder revision for existing databases

Revision ID: 014
Revises: 013
Create Date: 2026-02-26 22:30:00.000000
"""

from typing import Union


revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    # This revision is intentionally a no-op placeholder to match existing DB history.
    pass


def downgrade() -> None:
    pass
