"""tasks: bildirim gorevleri, bildirim basina tek aktif gorev (E4-1, docs/DATABASE.md "tasks")

Revision ID: e922a66dcd39
Revises: 8136bbed56c5
Create Date: 2026-09-29 18:42:41.709010
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e922a66dcd39"
down_revision: str | None = "8136bbed56c5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("case_id", sa.BigInteger(), nullable=False),
        sa.Column("department_id", sa.BigInteger(), nullable=False),
        sa.Column("assigned_user_id", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "ACCEPTED",
                "IN_PROGRESS",
                "COMPLETED",
                "DECLINED",
                "CANCELLED",
                name="task_status",
            ),
            nullable=False,
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completion_note", sa.Text(), nullable=True),
        sa.Column("declined_reason", sa.Text(), nullable=True),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["assigned_user_id"], ["users.id"], name=op.f("fk_tasks_assigned_user_id_users")
        ),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], name=op.f("fk_tasks_case_id_cases")),
        sa.ForeignKeyConstraint(
            ["department_id"], ["departments.id"], name=op.f("fk_tasks_department_id_departments")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index(
        "ix_tasks_assigned_user_id_status", "tasks", ["assigned_user_id", "status"], unique=False
    )
    op.create_index(
        "ix_tasks_department_id_status", "tasks", ["department_id", "status"], unique=False
    )
    op.create_index(
        "uq_tasks_one_active_per_case",
        "tasks",
        ["case_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS')"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_tasks_one_active_per_case",
        table_name="tasks",
        postgresql_where=sa.text("status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS')"),
    )
    op.drop_index("ix_tasks_department_id_status", table_name="tasks")
    op.drop_index("ix_tasks_assigned_user_id_status", table_name="tasks")
    op.drop_table("tasks")
    # Native enum tipi tabloyla birlikte silinmez; elle kaldirilir
    sa.Enum(name="task_status").drop(op.get_bind(), checkfirst=False)
