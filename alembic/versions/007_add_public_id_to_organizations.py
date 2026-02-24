"""add_public_id_to_organizations

Revision ID: 007
Revises: 006
Create Date: 2026-02-24

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("public_id", sa.String(length=64), nullable=True))
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE organizations
            SET public_id = 'org-' || SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 12)
            WHERE public_id IS NULL
            """
        )
    )
    op.alter_column("organizations", "public_id", nullable=False)
    op.create_index(op.f("ix_organizations_public_id"), "organizations", ["public_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_organizations_public_id"), table_name="organizations")
    op.drop_column("organizations", "public_id")
