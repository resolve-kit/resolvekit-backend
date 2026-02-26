"""add_organization_onboarding_state

Revision ID: 016
Revises: 015
Create Date: 2026-02-26 23:30:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("onboarding_target_app_id", sa.Uuid(), nullable=True))
    op.add_column("organizations", sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "organizations",
        sa.Column("onboarding_reset_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_organizations_onboarding_target_app_id",
        "organizations",
        ["onboarding_target_app_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_organizations_onboarding_target_app_id", table_name="organizations")
    op.drop_column("organizations", "onboarding_reset_count")
    op.drop_column("organizations", "onboarding_completed_at")
    op.drop_column("organizations", "onboarding_target_app_id")
