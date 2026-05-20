"""Add severity field to registered_functions

Revision ID: 022
Revises: 021
Create Date: 2026-05-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "registered_functions",
        sa.Column(
            "severity",
            sa.String(16),
            nullable=False,
            server_default="read",
        ),
    )


def downgrade() -> None:
    op.drop_column("registered_functions", "severity")
