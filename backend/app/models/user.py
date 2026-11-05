from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    String,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, IdMixin
from app.models.enums import ReporterKind, UserRole


class User(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        # reporter_kind yalniz REPORTER rolunde anlamlidir
        CheckConstraint(
            "role = 'REPORTER' OR reporter_kind IS NULL", name="reporter_kind_only_for_reporter"
        ),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), index=True
    )
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"))
    reporter_kind: Mapped[ReporterKind | None] = mapped_column(
        Enum(ReporterKind, name="reporter_kind")
    )
    # STAFF/MANAGER icin dolu olur
    department_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("departments.id"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
