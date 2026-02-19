"""Add description_override to functions, create playbooks and playbook_functions tables

Revision ID: 002
Revises: 001
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add description_override to registered_functions
    op.add_column(
        "registered_functions",
        sa.Column("description_override", sa.String(1000), nullable=True),
    )

    # Create playbooks table
    op.create_table(
        "playbooks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("app_id", sa.Uuid(), sa.ForeignKey("apps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("instructions", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("app_id", "name", name="uq_playbook_app_name"),
    )

    # Create playbook_functions association table
    op.create_table(
        "playbook_functions",
        sa.Column("playbook_id", sa.Uuid(), sa.ForeignKey("playbooks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("function_id", sa.Uuid(), sa.ForeignKey("registered_functions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("step_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("step_description", sa.Text(), nullable=True),
        sa.UniqueConstraint("playbook_id", "function_id", name="uq_playbook_function"),
    )


def downgrade() -> None:
    op.drop_table("playbook_functions")
    op.drop_table("playbooks")
    op.drop_column("registered_functions", "description_override")
