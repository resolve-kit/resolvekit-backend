"""add_kb_vision_mode_to_agent_configs

Revision ID: 017
Revises: 016
Create Date: 2026-02-28 16:10:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agent_configs",
        sa.Column("kb_vision_mode", sa.String(length=20), nullable=False, server_default="ocr_safe"),
    )


def downgrade() -> None:
    op.drop_column("agent_configs", "kb_vision_mode")
