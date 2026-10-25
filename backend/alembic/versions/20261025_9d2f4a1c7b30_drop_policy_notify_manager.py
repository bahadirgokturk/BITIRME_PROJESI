"""agent policies: notify_manager kaldirilir (mudure haber L2_NOTIFY'in kendisi, #93)

Supervisor bu alana hic bakmiyordu; ekranda etkisiz bir ayar olarak duruyordu.

Revision ID: 9d2f4a1c7b30
Revises: 5b1e0c7d9a21
Create Date: 2026-10-25 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9d2f4a1c7b30"
down_revision: str | None = "5b1e0c7d9a21"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("agent_policies", "notify_manager")


def downgrade() -> None:
    op.add_column(
        "agent_policies",
        sa.Column("notify_manager", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    # Eski davranis: L2 politikalarinda acik
    op.execute("UPDATE agent_policies SET notify_manager = true WHERE autonomy_level = 'L2_NOTIFY'")
