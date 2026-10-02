"""agent decisions and policies (E5-8, docs/DATABASE.md "agent_decisions", "agent_policies")

Revision ID: 6e77d0262fb6
Revises: 102aea28c3f3
Create Date: 2026-10-02 08:59:49.545260
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "6e77d0262fb6"
down_revision: str | None = "102aea28c3f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

POLICY_SCOPE = postgresql.ENUM("CASE_TYPE", "CATEGORY", name="policy_scope")
AUTONOMY_LEVEL = postgresql.ENUM("L1_AUTONOMOUS", "L2_NOTIFY", "L3_ESCALATE", name="autonomy_level")


def upgrade() -> None:
    POLICY_SCOPE.create(op.get_bind())
    AUTONOMY_LEVEL.create(op.get_bind())
    op.create_table(
        "agent_policies",
        sa.Column("organization_id", sa.BigInteger(), nullable=False),
        sa.Column("scope", postgresql.ENUM(name="policy_scope", create_type=False), nullable=False),
        sa.Column("case_type_id", sa.BigInteger(), nullable=True),
        # case_category tipi cases tablosuyla birlikte olusturuldu
        sa.Column(
            "category", postgresql.ENUM(name="case_category", create_type=False), nullable=True
        ),
        sa.Column(
            "autonomy_level",
            postgresql.ENUM(name="autonomy_level", create_type=False),
            nullable=False,
        ),
        sa.Column("min_confidence_auto", sa.Numeric(precision=4, scale=3), nullable=False),
        sa.Column("notify_manager", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint(
            "(scope = 'CASE_TYPE' AND case_type_id IS NOT NULL AND category IS NULL) OR "
            "(scope = 'CATEGORY' AND category IS NOT NULL AND case_type_id IS NULL)",
            name=op.f("ck_agent_policies_scope_target"),
        ),
        sa.CheckConstraint(
            "min_confidence_auto BETWEEN 0 AND 1",
            name=op.f("ck_agent_policies_min_confidence_range"),
        ),
        sa.ForeignKeyConstraint(
            ["case_type_id"],
            ["case_types.id"],
            name=op.f("fk_agent_policies_case_type_id_case_types"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_agent_policies_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_policies")),
        sa.UniqueConstraint(
            "organization_id",
            "scope",
            "case_type_id",
            "category",
            name=op.f("uq_agent_policies_organization_id_scope_case_type_id_category"),
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_index(
        op.f("ix_agent_policies_organization_id"), "agent_policies", ["organization_id"]
    )
    op.create_table(
        "agent_decisions",
        sa.Column("case_id", sa.BigInteger(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("agent_name", sa.String(length=50), nullable=False),
        sa.Column("decision", sa.String(length=50), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=4, scale=3), nullable=True),
        sa.Column("reason_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("input_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("output_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.ForeignKeyConstraint(
            ["case_id"], ["cases.id"], name=op.f("fk_agent_decisions_case_id_cases")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_agent_decisions")),
    )
    op.create_index(
        "ix_agent_decisions_case_id_created_at", "agent_decisions", ["case_id", "created_at"]
    )
    op.create_index(op.f("ix_agent_decisions_run_id"), "agent_decisions", ["run_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_agent_decisions_run_id"), table_name="agent_decisions")
    op.drop_index("ix_agent_decisions_case_id_created_at", table_name="agent_decisions")
    op.drop_table("agent_decisions")
    op.drop_index(op.f("ix_agent_policies_organization_id"), table_name="agent_policies")
    op.drop_table("agent_policies")
    AUTONOMY_LEVEL.drop(op.get_bind())
    POLICY_SCOPE.drop(op.get_bind())
