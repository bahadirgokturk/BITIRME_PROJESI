"""refresh_tokens.replaced_by_id: rotasyonla mi iptal edildigini ayirt eder (es zamanli istek toleransi)

Revision ID: 96471cf00a8a
Revises: 6d853b2b5f1f
Create Date: 2026-09-26 19:59:28.069714
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "96471cf00a8a"
down_revision: str | None = "6d853b2b5f1f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("refresh_tokens", sa.Column("replaced_by_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        op.f("fk_refresh_tokens_replaced_by_id_refresh_tokens"),
        "refresh_tokens",
        "refresh_tokens",
        ["replaced_by_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_refresh_tokens_replaced_by_id_refresh_tokens"),
        "refresh_tokens",
        type_="foreignkey",
    )
    op.drop_column("refresh_tokens", "replaced_by_id")
