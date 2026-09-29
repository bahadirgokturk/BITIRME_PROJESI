from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    UniqueConstraint,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import PERCENT, SLA_WARNING_PCT_DEFAULT
from app.models.base import Base, IdMixin
from app.models.enums import Priority


class SlaRule(IdMixin, Base):
    """Hedef sureler (docs/DATABASE.md "sla_rules"). case_type_id bos: o oncelik icin varsayilan.

    Eslesme: once (bildirim tipi, oncelik), yoksa (varsayilan, oncelik) - app/services/sla.py.
    """

    __tablename__ = "sla_rules"
    __table_args__ = (
        # NULL tip de tekil sayilir: bir oncelik icin tek varsayilan kural
        UniqueConstraint(
            "organization_id", "case_type_id", "priority", postgresql_nulls_not_distinct=True
        ),
        CheckConstraint("response_minutes > 0 AND resolution_minutes > 0", name="positive_minutes"),
        CheckConstraint(
            f"warning_threshold_pct BETWEEN 1 AND {PERCENT - 1}", name="warning_pct_range"
        ),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), index=True
    )
    case_type_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("case_types.id"))
    priority: Mapped[Priority] = mapped_column(Enum(Priority, name="priority", create_type=False))
    # Kabul hedefi (gorevin kabul edilmesi) ve cozum hedefi; bildirimin olusturulmasindan itibaren
    response_minutes: Mapped[int] = mapped_column(Integer)
    resolution_minutes: Mapped[int] = mapped_column(Integer)
    warning_threshold_pct: Mapped[int] = mapped_column(
        SmallInteger, server_default=str(SLA_WARNING_PCT_DEFAULT)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
