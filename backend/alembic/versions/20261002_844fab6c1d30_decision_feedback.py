"""decision feedback: manager duzeltmeleri (E5-9, docs/DATABASE.md "decision_feedback")

Revision ID: 844fab6c1d30
Revises: 6e77d0262fb6
Create Date: 2026-10-02 09:41:33.521021
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "844fab6c1d30"
down_revision: str | None = "6e77d0262fb6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "decision_feedback",
        sa.Column("decision_id", sa.BigInteger(), nullable=True),
        sa.Column("case_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("field", sa.String(length=30), nullable=False),
        sa.Column("original_value", sa.String(length=100), nullable=True),
        sa.Column("corrected_value", sa.String(length=100), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.ForeignKeyConstraint(
            ["case_id"], ["cases.id"], name=op.f("fk_decision_feedback_case_id_cases")
        ),
        sa.ForeignKeyConstraint(
            ["decision_id"],
            ["agent_decisions.id"],
            name=op.f("fk_decision_feedback_decision_id_agent_decisions"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_decision_feedback_user_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_decision_feedback")),
    )
    op.create_index(
        op.f("ix_decision_feedback_case_id"), "decision_feedback", ["case_id"], unique=False
    )
    op.create_index(
        op.f("ix_decision_feedback_decision_id"), "decision_feedback", ["decision_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_decision_feedback_decision_id"), table_name="decision_feedback")
    op.drop_index(op.f("ix_decision_feedback_case_id"), table_name="decision_feedback")
    op.drop_table("decision_feedback")
