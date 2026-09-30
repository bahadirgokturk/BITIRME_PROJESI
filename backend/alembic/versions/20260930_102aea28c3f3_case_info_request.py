"""case info request: NEEDS_INFO iken bildirim yapana sorulan soru (docs/DATABASE.md "cases")

Revision ID: 102aea28c3f3
Revises: 1fa5802f4664
Create Date: 2026-09-30 11:40:24.929553
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "102aea28c3f3"
down_revision: str | None = "1fa5802f4664"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("cases", sa.Column("info_request", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("cases", "info_request")
