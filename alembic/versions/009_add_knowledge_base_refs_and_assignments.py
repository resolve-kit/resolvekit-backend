"""add_knowledge_base_refs_and_assignments

Revision ID: 009
Revises: 008
Create Date: 2026-02-24 19:05:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_base_refs",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("external_kb_id", sa.String(length=64), nullable=False),
        sa.Column("name_cache", sa.String(length=255), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "external_kb_id", name="uq_kb_refs_org_external"),
    )
    op.create_index("ix_knowledge_base_refs_organization_id", "knowledge_base_refs", ["organization_id"], unique=False)
    op.create_index("ix_knowledge_base_refs_external_kb_id", "knowledge_base_refs", ["external_kb_id"], unique=False)

    op.create_table(
        "app_knowledge_bases",
        sa.Column("app_id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_base_ref_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["knowledge_base_ref_id"], ["knowledge_base_refs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("app_id", "knowledge_base_ref_id"),
        sa.UniqueConstraint("app_id", "knowledge_base_ref_id", name="uq_app_knowledge_base"),
    )
    op.create_index(
        "ix_app_knowledge_bases_knowledge_base_ref_id",
        "app_knowledge_bases",
        ["knowledge_base_ref_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_app_knowledge_bases_knowledge_base_ref_id", table_name="app_knowledge_bases")
    op.drop_table("app_knowledge_bases")

    op.drop_index("ix_knowledge_base_refs_external_kb_id", table_name="knowledge_base_refs")
    op.drop_index("ix_knowledge_base_refs_organization_id", table_name="knowledge_base_refs")
    op.drop_table("knowledge_base_refs")
