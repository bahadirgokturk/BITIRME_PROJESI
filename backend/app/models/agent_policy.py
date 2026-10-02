"""Otonomi politikasi (docs/DATABASE.md "agent_policies", docs/AGENTS.md bolum 5).

Supervisor her bildirim tipi icin ne kadar kendi karar verecegini buradan okur. Kampus seed'i tip
basina bir satir (CASE_TYPE) yazar; CATEGORY kapsami admin panelinden genel kural icin ayrilmistir.
"""

from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Enum,
    ForeignKey,
    UniqueConstraint,
    false,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin
from app.models.case import SCORE
from app.models.enums import AutonomyLevel, CaseCategory, PolicyScope


class AgentPolicy(IdMixin, Base):
    __tablename__ = "agent_policies"
    __table_args__ = (
        # Ayni kapsam icin tek politika (NULL alanlar da esit sayilir)
        UniqueConstraint(
            "organization_id",
            "scope",
            "case_type_id",
            "category",
            postgresql_nulls_not_distinct=True,
        ),
        CheckConstraint(
            "(scope = 'CASE_TYPE' AND case_type_id IS NOT NULL AND category IS NULL) OR "
            "(scope = 'CATEGORY' AND category IS NOT NULL AND case_type_id IS NULL)",
            name="scope_target",
        ),
        CheckConstraint("min_confidence_auto BETWEEN 0 AND 1", name="min_confidence_range"),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), index=True
    )
    scope: Mapped[PolicyScope] = mapped_column(Enum(PolicyScope, name="policy_scope"))
    case_type_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("case_types.id"))
    category: Mapped[CaseCategory | None] = mapped_column(
        Enum(CaseCategory, name="case_category", create_type=False)
    )
    autonomy_level: Mapped[AutonomyLevel] = mapped_column(
        Enum(AutonomyLevel, name="autonomy_level")
    )
    # Siniflandirma guveni bunun altindaysa insan incelemesi (Supervisor kural 5)
    min_confidence_auto: Mapped[Decimal] = mapped_column(SCORE)
    notify_manager: Mapped[bool] = mapped_column(Boolean, server_default=false())
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
