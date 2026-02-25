"""add_scope_mode_to_agent_configs

Revision ID: 011
Revises: 010
Create Date: 2026-02-25 13:05:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_configs",
        sa.Column("scope_mode", sa.String(length=20), nullable=False, server_default=sa.text("'open'")),
    )


def downgrade() -> None:
    op.drop_column("agent_configs", "scope_mode")
