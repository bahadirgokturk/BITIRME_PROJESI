from sqlalchemy import BigInteger, Boolean, ForeignKey, String, UniqueConstraint, true
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, CreatedAtMixin, IdMixin


class Department(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("organization_id", "code"),)

    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), index=True
    )
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
