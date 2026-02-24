"""add_organizations_and_invitations

Revision ID: 006
Revises: e6e264a2dd4e
Create Date: 2026-02-24

"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "e6e264a2dd4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _default_org_name(name: str) -> str:
    normalized = (name or "").strip()
    if normalized:
        return f"{normalized}'s Organization"
    return "My Organization"


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column("developer_accounts", sa.Column("organization_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_developer_accounts_organization_id"),
        "developer_accounts",
        ["organization_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_developer_accounts_organization_id",
        "developer_accounts",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_table(
        "organization_invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("inviter_developer_id", sa.Uuid(), nullable=False),
        sa.Column("invitee_developer_id", sa.Uuid(), nullable=False),
        sa.Column("invitee_email", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["invitee_developer_id"], ["developer_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["inviter_developer_id"], ["developer_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_organization_invitations_invitee_developer_id"),
        "organization_invitations",
        ["invitee_developer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_invitations_invitee_email"),
        "organization_invitations",
        ["invitee_email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_invitations_inviter_developer_id"),
        "organization_invitations",
        ["inviter_developer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_invitations_organization_id"),
        "organization_invitations",
        ["organization_id"],
        unique=False,
    )

    op.add_column("apps", sa.Column("organization_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_apps_organization_id"), "apps", ["organization_id"], unique=False)
    op.create_foreign_key(
        "fk_apps_organization_id",
        "apps",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
    )

    connection = op.get_bind()
    developers = connection.execute(sa.text("SELECT id, email, name FROM developer_accounts")).mappings().all()
    now = datetime.now(timezone.utc)

    for developer in developers:
        org_id = uuid.uuid4()
        connection.execute(
            sa.text(
                """
                INSERT INTO organizations (id, name, created_at)
                VALUES (:id, :name, :created_at)
                """
            ),
            {
                "id": org_id,
                "name": _default_org_name(developer["name"]),
                "created_at": now,
            },
        )
        connection.execute(
            sa.text(
                """
                UPDATE developer_accounts
                SET organization_id = :organization_id,
                    email = LOWER(TRIM(email))
                WHERE id = :developer_id
                """
            ),
            {"organization_id": org_id, "developer_id": developer["id"]},
        )
        connection.execute(
            sa.text(
                """
                UPDATE apps
                SET organization_id = :organization_id
                WHERE developer_id = :developer_id
                """
            ),
            {"organization_id": org_id, "developer_id": developer["id"]},
        )

    op.alter_column("developer_accounts", "organization_id", nullable=False)
    op.alter_column("apps", "organization_id", nullable=False)

    op.drop_constraint("uq_app_developer_name", "apps", type_="unique")
    op.create_unique_constraint("uq_app_organization_name", "apps", ["organization_id", "name"])


def downgrade() -> None:
    op.drop_constraint("uq_app_organization_name", "apps", type_="unique")
    op.create_unique_constraint("uq_app_developer_name", "apps", ["developer_id", "name"])

    op.drop_constraint("fk_apps_organization_id", "apps", type_="foreignkey")
    op.drop_index(op.f("ix_apps_organization_id"), table_name="apps")
    op.drop_column("apps", "organization_id")

    op.drop_index(
        op.f("ix_organization_invitations_organization_id"), table_name="organization_invitations"
    )
    op.drop_index(
        op.f("ix_organization_invitations_inviter_developer_id"), table_name="organization_invitations"
    )
    op.drop_index(op.f("ix_organization_invitations_invitee_email"), table_name="organization_invitations")
    op.drop_index(
        op.f("ix_organization_invitations_invitee_developer_id"), table_name="organization_invitations"
    )
    op.drop_table("organization_invitations")

    op.drop_constraint("fk_developer_accounts_organization_id", "developer_accounts", type_="foreignkey")
    op.drop_index(op.f("ix_developer_accounts_organization_id"), table_name="developer_accounts")
    op.drop_column("developer_accounts", "organization_id")

    op.drop_table("organizations")
