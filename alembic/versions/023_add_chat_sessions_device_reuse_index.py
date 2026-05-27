"""Add composite index on chat_sessions for device-based session reuse lookup

Without this index, the query in get_reusable_session() performs a sequential
scan of the entire chat_sessions table for every POST /v1/sessions request.
At 100K+ historical sessions this becomes a multi-hundred-millisecond query.

The partial index (WHERE status = 'active') keeps the index small since most
sessions are eventually expired/closed.

Revision ID: 023
Revises: 022
Create Date: 2026-05-27

"""
from typing import Sequence, Union

from alembic import op

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "idx_chat_sessions_device_reuse",
        "chat_sessions",
        ["app_id", "device_id", "last_activity_at"],
        postgresql_where="status = 'active'",
    )


def downgrade() -> None:
    op.drop_index("idx_chat_sessions_device_reuse", table_name="chat_sessions")
