"""remove entitlements/capabilities and add session allowlist

Revision ID: 021
Revises: 020
Create Date: 2026-03-04

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column(
            "available_function_names",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    op.drop_column("chat_sessions", "entitlements")
    op.drop_column("chat_sessions", "capabilities")
    op.drop_column("registered_functions", "required_entitlements")
    op.drop_column("registered_functions", "required_capabilities")


def downgrade() -> None:
    op.add_column(
        "registered_functions",
        sa.Column(
            "required_capabilities",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "registered_functions",
        sa.Column(
            "required_entitlements",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "chat_sessions",
        sa.Column(
            "capabilities",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
    op.add_column(
        "chat_sessions",
        sa.Column(
            "entitlements",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    op.drop_column("chat_sessions", "available_function_names")
