"""add_app_integration_controls

Revision ID: 010
Revises: 009
Create Date: 2026-02-25 00:30:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.add_column(
        "apps",
        sa.Column("integration_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "apps",
        sa.Column("integration_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )


def downgrade() -> None:
    op.drop_column("apps", "integration_version")
    op.drop_column("apps", "integration_enabled")
