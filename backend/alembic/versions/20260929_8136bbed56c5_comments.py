"""comments: bildirim yorumlari ve ic notlar (E3-5, docs/DATABASE.md "comments")

Revision ID: 8136bbed56c5
Revises: 52cc2987b106
Create Date: 2026-09-29 17:37:30.761735
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8136bbed56c5"
down_revision: str | None = "52cc2987b106"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("case_id", sa.BigInteger(), nullable=False),
        sa.Column("author_id", sa.BigInteger(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_internal", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], name=op.f("fk_comments_author_id_users")
        ),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], name=op.f("fk_comments_case_id_cases")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_comments")),
    )
    op.create_index(
        "ix_comments_case_id_created_at", "comments", ["case_id", "created_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_comments_case_id_created_at", table_name="comments")
    op.drop_table("comments")
