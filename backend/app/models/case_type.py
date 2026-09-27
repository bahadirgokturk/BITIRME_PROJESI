from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Enum,
    ForeignKey,
    SmallInteger,
    String,
    UniqueConstraint,
    false,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import SEVERITY_MAX, SEVERITY_MIN
from app.models.base import Base, IdMixin
from app.models.enums import CaseCategory, Priority


class CaseType(IdMixin, Base):
    """Bildirim tipi ve yonlendirme kurali; kampus icin kaynak docs/DEPARTMENTS.md bolum 3."""

    __tablename__ = "case_types"
    __table_args__ = (
        UniqueConstraint("organization_id", "code"),
        CheckConstraint(
            f"base_severity BETWEEN {SEVERITY_MIN} AND {SEVERITY_MAX}", name="base_severity_range"
        ),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), index=True
    )
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[CaseCategory] = mapped_column(Enum(CaseCategory, name="case_category"))
    # Birincil birim gorevi alir; OTHER (insan inceler) ve OUT_OF_SCOPE (gorev yok) icin bos
    default_department_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("departments.id")
    )
    # Ikincil birim yalniz bilgilendirilir (or. su taskini: tesisat + temizlik)
    secondary_department_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("departments.id")
    )
    base_priority: Mapped[Priority] = mapped_column(Enum(Priority, name="priority"))
    base_severity: Mapped[int] = mapped_column(SmallInteger)
    is_safety_related: Mapped[bool] = mapped_column(Boolean, server_default=false())
    # Kural tabanli siniflandirma sozlugu (Classification Agent)
    keywords: Mapped[list[Any]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
