"""cases: idempotency_key (POST /cases Idempotency-Key, cevrimdisi gonderim #135)

Baglanti kopunca ayni bildirim tekrar gonderilirse ikinci kayit olusmaz. Anahtar bildiren basina
tekildir; NULL degerler (anahtarsiz bildirimler) kisitlamaya takilmaz.

Revision ID: 7c4e2b9d1f05
Revises: 9d2f4a1c7b30
Create Date: 2026-10-29 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7c4e2b9d1f05"
down_revision: str | None = "9d2f4a1c7b30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CONSTRAINT = "uq_cases_reporter_id_idempotency_key"


def upgrade() -> None:
    op.add_column("cases", sa.Column("idempotency_key", sa.String(length=100), nullable=True))
    op.create_unique_constraint(CONSTRAINT, "cases", ["reporter_id", "idempotency_key"])


def downgrade() -> None:
    op.drop_constraint(CONSTRAINT, "cases", type_="unique")
    op.drop_column("cases", "idempotency_key")
