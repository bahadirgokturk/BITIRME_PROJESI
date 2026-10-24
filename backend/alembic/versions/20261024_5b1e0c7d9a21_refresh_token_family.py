"""refresh token family: calinma tespitinde yalniz o oturum kapanir

Revision ID: 5b1e0c7d9a21
Revises: c48da41c4dc2
Create Date: 2026-10-24 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5b1e0c7d9a21"
down_revision: str | None = "c48da41c4dc2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("refresh_tokens", sa.Column("family_id", sa.Uuid(), nullable=True))
    # Mevcut kayitlarin zinciri bilinmez: her biri kendi ailesi (en fazla kendisini kapatir)
    op.execute("UPDATE refresh_tokens SET family_id = gen_random_uuid()")
    op.alter_column("refresh_tokens", "family_id", nullable=False)
    op.create_index(
        op.f("ix_refresh_tokens_family_id"), "refresh_tokens", ["family_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_refresh_tokens_family_id"), table_name="refresh_tokens")
    op.drop_column("refresh_tokens", "family_id")
