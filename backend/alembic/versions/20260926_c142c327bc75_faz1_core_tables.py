"""FAZ 1 cekirdek tablolar: organizations, departments, locations, users

Revision ID: c142c327bc75
Revises:
Create Date: 2026-09-26 13:35:38.837884
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c142c327bc75"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("template_code", sa.String(length=30), nullable=False),
        sa.Column(
            "timezone", sa.String(length=50), server_default="Europe/Istanbul", nullable=False
        ),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizations")),
    )
    op.create_table(
        "departments",
        sa.Column("organization_id", sa.BigInteger(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_departments_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_departments")),
        sa.UniqueConstraint(
            "organization_id", "code", name=op.f("uq_departments_organization_id_code")
        ),
    )
    op.create_index(
        op.f("ix_departments_organization_id"), "departments", ["organization_id"], unique=False
    )
    op.create_table(
        "locations",
        sa.Column("organization_id", sa.BigInteger(), nullable=False),
        sa.Column("parent_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "kind",
            sa.Enum(
                "CAMPUS",
                "BUILDING",
                "FLOOR",
                "ROOM",
                "WC",
                "CORRIDOR",
                "OUTDOOR",
                "OTHER",
                name="location_kind",
            ),
            nullable=False,
        ),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("importance_weight", sa.SmallInteger(), nullable=False),
        sa.Column(
            "aliases",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.CheckConstraint(
            "importance_weight BETWEEN 0 AND 100", name=op.f("ck_locations_importance_weight_range")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_locations_organization_id_organizations"),
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["locations.id"], name=op.f("fk_locations_parent_id_locations")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_locations")),
        sa.UniqueConstraint(
            "organization_id", "code", name=op.f("uq_locations_organization_id_code")
        ),
    )
    op.create_index(
        op.f("ix_locations_organization_id"), "locations", ["organization_id"], unique=False
    )
    op.create_index(op.f("ix_locations_parent_id"), "locations", ["parent_id"], unique=False)
    op.create_index(
        "ix_locations_path",
        "locations",
        ["path"],
        unique=False,
        postgresql_ops={"path": "varchar_pattern_ops"},
    )
    op.create_table(
        "users",
        sa.Column("organization_id", sa.BigInteger(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column(
            "role",
            sa.Enum("REPORTER", "STAFF", "MANAGER", "ADMIN", name="user_role"),
            nullable=False,
        ),
        sa.Column(
            "reporter_kind",
            sa.Enum("STUDENT", "ACADEMIC", "PERSONNEL", name="reporter_kind"),
            nullable=True,
        ),
        sa.Column("department_id", sa.BigInteger(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role = 'REPORTER' OR reporter_kind IS NULL",
            name=op.f("ck_users_reporter_kind_only_for_reporter"),
        ),
        sa.ForeignKeyConstraint(
            ["department_id"], ["departments.id"], name=op.f("fk_users_department_id_departments")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_users_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_index(op.f("ix_users_department_id"), "users", ["department_id"], unique=False)
    op.create_index(op.f("ix_users_organization_id"), "users", ["organization_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_organization_id"), table_name="users")
    op.drop_index(op.f("ix_users_department_id"), table_name="users")
    op.drop_table("users")
    op.drop_index(
        "ix_locations_path", table_name="locations", postgresql_ops={"path": "varchar_pattern_ops"}
    )
    op.drop_index(op.f("ix_locations_parent_id"), table_name="locations")
    op.drop_index(op.f("ix_locations_organization_id"), table_name="locations")
    op.drop_table("locations")
    op.drop_index(op.f("ix_departments_organization_id"), table_name="departments")
    op.drop_table("departments")
    op.drop_table("organizations")
    # Native enum tipleri tablolarla birlikte silinmez; elle kaldirilir
    for enum_name in ("reporter_kind", "user_role", "location_kind"):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=False)
