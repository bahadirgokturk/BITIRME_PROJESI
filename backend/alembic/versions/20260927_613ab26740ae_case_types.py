"""case types: bildirim tipleri ve yonlendirme (docs/DEPARTMENTS.md bolum 3)

Revision ID: 613ab26740ae
Revises: 96471cf00a8a
Create Date: 2026-09-27 13:44:59.711110
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "613ab26740ae"
down_revision: str | None = "96471cf00a8a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "case_types",
        sa.Column("organization_id", sa.BigInteger(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "CLEANING",
                "CONSUMABLE",
                "TECHNICAL",
                "IT",
                "INFRASTRUCTURE",
                "SECURITY",
                "FOOD_SERVICE",
                "OTHER",
                name="case_category",
            ),
            nullable=False,
        ),
        sa.Column("default_department_id", sa.BigInteger(), nullable=True),
        sa.Column("secondary_department_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "base_priority",
            sa.Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="priority"),
            nullable=False,
        ),
        sa.Column("base_severity", sa.SmallInteger(), nullable=False),
        sa.Column(
            "is_safety_related", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column(
            "keywords",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint(
            "base_severity BETWEEN 0 AND 100", name=op.f("ck_case_types_base_severity_range")
        ),
        sa.ForeignKeyConstraint(
            ["default_department_id"],
            ["departments.id"],
            name=op.f("fk_case_types_default_department_id_departments"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_case_types_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["secondary_department_id"],
            ["departments.id"],
            name=op.f("fk_case_types_secondary_department_id_departments"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_case_types")),
        sa.UniqueConstraint(
            "organization_id", "code", name=op.f("uq_case_types_organization_id_code")
        ),
    )
    op.create_index(
        op.f("ix_case_types_organization_id"), "case_types", ["organization_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_case_types_organization_id"), table_name="case_types")
    op.drop_table("case_types")
    # Native enum tipleri tablolarla birlikte silinmez; elle kaldirilir
    for enum_name in ("case_category", "priority"):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=False)
