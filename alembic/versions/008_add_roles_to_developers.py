"""add_roles_to_developers

Revision ID: 008
Revises: 007
Create Date: 2026-02-24

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "developer_accounts",
        sa.Column("role", sa.String(length=20), nullable=True, server_default="member"),
    )
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT id, organization_id,
                       ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at ASC, id ASC) AS rn
                FROM developer_accounts
            )
            UPDATE developer_accounts AS da
            SET role = CASE WHEN ranked.rn = 1 THEN 'owner' ELSE 'member' END
            FROM ranked
            WHERE da.id = ranked.id
            """
        )
    )
    op.alter_column("developer_accounts", "role", nullable=False, server_default="member")
    op.create_check_constraint(
        "ck_developer_accounts_role",
        "developer_accounts",
        "role IN ('owner','admin','member')",
    )
    op.create_index(
        "ix_developer_accounts_organization_id_role",
        "developer_accounts",
        ["organization_id", "role"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_developer_accounts_organization_id_role", table_name="developer_accounts")
    op.drop_constraint("ck_developer_accounts_role", "developer_accounts", type_="check")
    op.drop_column("developer_accounts", "role")
