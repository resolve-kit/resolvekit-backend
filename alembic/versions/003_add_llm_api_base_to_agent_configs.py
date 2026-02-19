"""add llm_api_base to agent_configs

Revision ID: 003
Revises: 002
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agent_configs", sa.Column("llm_api_base", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("agent_configs", "llm_api_base")
