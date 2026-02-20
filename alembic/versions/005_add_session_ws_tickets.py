"""add session websocket tickets

Revision ID: 005
Revises: 004
Create Date: 2026-02-20

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "session_ws_tickets",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("app_id", sa.Uuid(), nullable=False),
        sa.Column("ticket_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_session_ws_tickets_app_id"), "session_ws_tickets", ["app_id"], unique=False)
    op.create_index(op.f("ix_session_ws_tickets_expires_at"), "session_ws_tickets", ["expires_at"], unique=False)
    op.create_index(op.f("ix_session_ws_tickets_session_id"), "session_ws_tickets", ["session_id"], unique=False)
    op.create_index(op.f("ix_session_ws_tickets_ticket_hash"), "session_ws_tickets", ["ticket_hash"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_session_ws_tickets_ticket_hash"), table_name="session_ws_tickets")
    op.drop_index(op.f("ix_session_ws_tickets_session_id"), table_name="session_ws_tickets")
    op.drop_index(op.f("ix_session_ws_tickets_expires_at"), table_name="session_ws_tickets")
    op.drop_index(op.f("ix_session_ws_tickets_app_id"), table_name="session_ws_tickets")
    op.drop_table("session_ws_tickets")
