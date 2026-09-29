"""sla rules: hedef sureler ve bildirimin eslesen kurali (E4-2, docs/DATABASE.md "sla_rules")

Revision ID: 1fa5802f4664
Revises: e922a66dcd39
Create Date: 2026-09-29 18:59:31.552667
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "1fa5802f4664"
down_revision: str | None = "e922a66dcd39"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sla_rules",
        sa.Column("organization_id", sa.BigInteger(), nullable=False),
        sa.Column("case_type_id", sa.BigInteger(), nullable=True),
        sa.Column("priority", postgresql.ENUM(name="priority", create_type=False), nullable=False),
        sa.Column("response_minutes", sa.Integer(), nullable=False),
        sa.Column("resolution_minutes", sa.Integer(), nullable=False),
        sa.Column("warning_threshold_pct", sa.SmallInteger(), server_default="75", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint(
            "response_minutes > 0 AND resolution_minutes > 0",
            name=op.f("ck_sla_rules_positive_minutes"),
        ),
        sa.CheckConstraint(
            "warning_threshold_pct BETWEEN 1 AND 99", name=op.f("ck_sla_rules_warning_pct_range")
        ),
        sa.ForeignKeyConstraint(
            ["case_type_id"], ["case_types.id"], name=op.f("fk_sla_rules_case_type_id_case_types")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_sla_rules_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sla_rules")),
        sa.UniqueConstraint(
            "organization_id",
            "case_type_id",
            "priority",
            name=op.f("uq_sla_rules_organization_id_case_type_id_priority"),
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_index(
        op.f("ix_sla_rules_organization_id"), "sla_rules", ["organization_id"], unique=False
    )
    op.add_column("cases", sa.Column("sla_rule_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        op.f("fk_cases_sla_rule_id_sla_rules"), "cases", "sla_rules", ["sla_rule_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_cases_sla_rule_id_sla_rules"), "cases", type_="foreignkey")
    op.drop_column("cases", "sla_rule_id")
    op.drop_index(op.f("ix_sla_rules_organization_id"), table_name="sla_rules")
    op.drop_table("sla_rules")
