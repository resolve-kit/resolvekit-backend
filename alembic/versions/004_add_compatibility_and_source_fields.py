"""add compatibility and source fields

Revision ID: 004
Revises: 003
Create Date: 2026-02-20

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "registered_functions",
        sa.Column("availability", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "registered_functions",
        sa.Column("required_entitlements", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "registered_functions",
        sa.Column("required_capabilities", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "registered_functions",
        sa.Column("source", sa.String(length=32), nullable=False, server_default="app_inline"),
    )
    op.add_column("registered_functions", sa.Column("pack_name", sa.String(length=255), nullable=True))

    op.add_column(
        "chat_sessions",
        sa.Column("client_context", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "chat_sessions",
        sa.Column("entitlements", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "chat_sessions",
        sa.Column("capabilities", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("chat_sessions", "capabilities")
    op.drop_column("chat_sessions", "entitlements")
    op.drop_column("chat_sessions", "client_context")

    op.drop_column("registered_functions", "pack_name")
    op.drop_column("registered_functions", "source")
    op.drop_column("registered_functions", "required_capabilities")
    op.drop_column("registered_functions", "required_entitlements")
    op.drop_column("registered_functions", "availability")
