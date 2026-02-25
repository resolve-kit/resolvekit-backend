"""set_scope_mode_default_strict

Revision ID: 013
Revises: 012
Create Date: 2026-02-25 14:35:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "agent_configs",
        "scope_mode",
        existing_type=sa.String(length=20),
        existing_nullable=False,
        server_default=sa.text("'strict'"),
    )


def downgrade() -> None:
    op.alter_column(
        "agent_configs",
        "scope_mode",
        existing_type=sa.String(length=20),
        existing_nullable=False,
        server_default=sa.text("'open'"),
    )

