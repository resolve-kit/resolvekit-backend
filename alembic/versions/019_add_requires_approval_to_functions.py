"""add_requires_approval_to_functions

Revision ID: 019
Revises: 018
Create Date: 2026-03-01 18:00:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "registered_functions",
        sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("registered_functions", "requires_approval")
