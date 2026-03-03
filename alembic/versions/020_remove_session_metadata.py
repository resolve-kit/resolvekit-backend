"""remove_session_metadata

Revision ID: 020
Revises: 019
Create Date: 2026-03-03 22:00:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.drop_column("chat_sessions", "metadata")


def downgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
