"""cases and case events: bildirimler ve zaman cizelgesi (E3-1, docs/DATABASE.md "cases")

Revision ID: 55157d9c4ef0
Revises: 613ab26740ae
Create Date: 2026-09-27 14:33:00.795205
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "55157d9c4ef0"
down_revision: str | None = "613ab26740ae"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # case_number (CASE-000124) icin; id'den bagimsiz
    op.execute(sa.schema.CreateSequence(sa.Sequence("case_number_seq")))
    op.create_table(
        "cases",
        sa.Column("organization_id", sa.BigInteger(), nullable=False),
        sa.Column("case_number", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("reporter_id", sa.BigInteger(), nullable=False),
        sa.Column("location_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "NEW",
                "ANALYZING",
                "NEEDS_INFO",
                "CLASSIFIED",
                "ASSIGNED",
                "ACCEPTED",
                "IN_PROGRESS",
                "RESOLVED",
                "VERIFICATION",
                "CLOSED",
                "REOPENED",
                "ESCALATED",
                "REJECTED",
                "MERGED",
                name="case_status",
            ),
            nullable=False,
        ),
        sa.Column("case_type_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "category", postgresql.ENUM(name="case_category", create_type=False), nullable=True
        ),
        sa.Column("department_id", sa.BigInteger(), nullable=True),
        sa.Column("priority", postgresql.ENUM(name="priority", create_type=False), nullable=True),
        sa.Column("impact_score", sa.SmallInteger(), nullable=True),
        sa.Column("confidence_score", sa.Numeric(precision=4, scale=3), nullable=True),
        sa.Column("verification_score", sa.Numeric(precision=4, scale=3), nullable=True),
        sa.Column("assigned_staff_id", sa.BigInteger(), nullable=True),
        sa.Column("parent_case_id", sa.BigInteger(), nullable=True),
        sa.Column("duplicate_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "needs_human_review", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("escalation_level", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("reopened_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("satisfaction_rating", sa.SmallInteger(), nullable=True),
        sa.Column("satisfaction_comment", sa.Text(), nullable=True),
        sa.Column("is_seed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("classified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("response_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "satisfaction_rating IS NULL OR satisfaction_rating BETWEEN 1 AND 5",
            name=op.f("ck_cases_satisfaction_rating_range"),
        ),
        sa.ForeignKeyConstraint(
            ["assigned_staff_id"], ["users.id"], name=op.f("fk_cases_assigned_staff_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["case_type_id"], ["case_types.id"], name=op.f("fk_cases_case_type_id_case_types")
        ),
        sa.ForeignKeyConstraint(
            ["department_id"], ["departments.id"], name=op.f("fk_cases_department_id_departments")
        ),
        sa.ForeignKeyConstraint(
            ["location_id"], ["locations.id"], name=op.f("fk_cases_location_id_locations")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_cases_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["parent_case_id"], ["cases.id"], name=op.f("fk_cases_parent_case_id_cases")
        ),
        sa.ForeignKeyConstraint(
            ["reporter_id"], ["users.id"], name=op.f("fk_cases_reporter_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cases")),
        sa.UniqueConstraint("case_number", name=op.f("uq_cases_case_number")),
    )
    op.create_index(
        op.f("ix_cases_assigned_staff_id"), "cases", ["assigned_staff_id"], unique=False
    )
    op.create_index(
        "ix_cases_department_id_status", "cases", ["department_id", "status"], unique=False
    )
    op.create_index(
        "ix_cases_location_type_created",
        "cases",
        ["location_id", "case_type_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_cases_organization_id_status", "cases", ["organization_id", "status"], unique=False
    )
    op.create_index(
        "ix_cases_reporter_id_created_at",
        "cases",
        ["reporter_id", sa.literal_column("created_at DESC")],
        unique=False,
    )
    op.create_table(
        "case_events",
        sa.Column("case_id", sa.BigInteger(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column(
            "actor_type", sa.Enum("USER", "AGENT", "SYSTEM", name="actor_type"), nullable=False
        ),
        sa.Column("actor_id", sa.BigInteger(), nullable=True),
        sa.Column("agent_name", sa.String(length=50), nullable=True),
        sa.Column(
            "from_status", postgresql.ENUM(name="case_status", create_type=False), nullable=True
        ),
        sa.Column(
            "to_status", postgresql.ENUM(name="case_status", create_type=False), nullable=True
        ),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "metadata_json",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name=op.f("fk_case_events_actor_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["case_id"], ["cases.id"], name=op.f("fk_case_events_case_id_cases")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_case_events")),
    )
    op.create_index(
        "ix_case_events_case_id_occurred_at",
        "case_events",
        ["case_id", "occurred_at"],
        unique=False,
    )
    op.create_index(
        "ix_case_events_event_type_occurred_at",
        "case_events",
        ["event_type", "occurred_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_case_events_event_type_occurred_at", table_name="case_events")
    op.drop_index("ix_case_events_case_id_occurred_at", table_name="case_events")
    op.drop_table("case_events")
    op.drop_index("ix_cases_reporter_id_created_at", table_name="cases")
    op.drop_index("ix_cases_organization_id_status", table_name="cases")
    op.drop_index("ix_cases_location_type_created", table_name="cases")
    op.drop_index("ix_cases_department_id_status", table_name="cases")
    op.drop_index(op.f("ix_cases_assigned_staff_id"), table_name="cases")
    op.drop_table("cases")
    op.execute(sa.schema.DropSequence(sa.Sequence("case_number_seq")))
    # Native enum tipleri tablolarla birlikte silinmez; elle kaldirilir
    for enum_name in ("case_status", "actor_type"):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=False)
