"""add_app_chat_theme

Revision ID: 014
Revises: 013
Create Date: 2026-02-26 22:00:00.000000
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, list[str], None] = None
depends_on: Union[str, list[str], None] = None


def upgrade() -> None:
    op.add_column(
        "apps",
        sa.Column(
            "chat_theme",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text(
                """'{
  "light": {
    "screenBackground": "#F7F7FA",
    "titleText": "#111827",
    "statusText": "#4B5563",
    "composerBackground": "#FFFFFF",
    "composerText": "#111827",
    "composerPlaceholder": "#9CA3AF",
    "userBubbleBackground": "#DBEAFE",
    "userBubbleText": "#1E3A8A",
    "assistantBubbleBackground": "#E5E7EB",
    "assistantBubbleText": "#111827",
    "loaderBubbleBackground": "#E5E7EB",
    "loaderDotActive": "#374151",
    "loaderDotInactive": "#9CA3AF",
    "toolCardBackground": "#FFFFFFCC",
    "toolCardBorder": "#D1D5DB",
    "toolCardTitle": "#111827",
    "toolCardBody": "#374151"
  },
  "dark": {
    "screenBackground": "#0B0C10",
    "titleText": "#E5E7EB",
    "statusText": "#9CA3AF",
    "composerBackground": "#111318",
    "composerText": "#E5E7EB",
    "composerPlaceholder": "#6B7280",
    "userBubbleBackground": "#1E3A8A99",
    "userBubbleText": "#DBEAFE",
    "assistantBubbleBackground": "#1F2937",
    "assistantBubbleText": "#E5E7EB",
    "loaderBubbleBackground": "#1F2937",
    "loaderDotActive": "#E5E7EB",
    "loaderDotInactive": "#6B7280",
    "toolCardBackground": "#111318CC",
    "toolCardBorder": "#374151",
    "toolCardTitle": "#E5E7EB",
    "toolCardBody": "#9CA3AF"
  }
}'::jsonb"""
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("apps", "chat_theme")
