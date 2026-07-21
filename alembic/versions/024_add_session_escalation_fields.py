"""Add escalation fields to chat_sessions

Revision ID: 024
Revises: 023
Create Date: 2026-07-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chat_sessions", sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("chat_sessions", sa.Column("escalation_reason", sa.Text(), nullable=True))
    op.add_column("chat_sessions", sa.Column("resolved_by", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_sessions", "resolved_by")
    op.drop_column("chat_sessions", "escalation_reason")
    op.drop_column("chat_sessions", "escalated_at")
