"""attachments: bildirim fotograflari (E3-3, docs/DATABASE.md "attachments")

Revision ID: 52cc2987b106
Revises: 55157d9c4ef0
Create Date: 2026-09-29 17:05:15.654320
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "52cc2987b106"
down_revision: str | None = "55157d9c4ef0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attachments",
        sa.Column("case_id", sa.BigInteger(), nullable=False),
        sa.Column("uploaded_by", sa.BigInteger(), nullable=False),
        sa.Column("kind", sa.Enum("REPORT", "EVIDENCE", name="attachment_kind"), nullable=False),
        sa.Column("storage_key", sa.String(length=100), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=50), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["case_id"], ["cases.id"], name=op.f("fk_attachments_case_id_cases")
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"], ["users.id"], name=op.f("fk_attachments_uploaded_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_attachments")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_attachments_storage_key")),
    )
    op.create_index(op.f("ix_attachments_case_id"), "attachments", ["case_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_attachments_case_id"), table_name="attachments")
    op.drop_table("attachments")
    # Native enum tipi tabloyla birlikte silinmez; elle kaldirilir
    sa.Enum(name="attachment_kind").drop(op.get_bind(), checkfirst=False)
