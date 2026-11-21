"""users: must_change_password (parola yonetimi)

Admin'in olusturdugu ya da sifirladigi parolayla giren kullanicidan kendi parolasini belirlemesi
istenir. Var olan kullanicilar etkilenmez (false).

Revision ID: 3a8f6c2e1d47
Revises: 7c4e2b9d1f05
Create Date: 2026-11-21 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3a8f6c2e1d47"
down_revision: str | None = "7c4e2b9d1f05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "must_change_password", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
