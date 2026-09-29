"""Bildirim (case) ve zaman cizelgesi (case_events). Sema: docs/DATABASE.md "cases".

status yalniz app/services/workflow.py uzerinden degisir; her gecis ayni transaction'da bir
case_events satiri yazar. case_events append-only'dir (guncelleme/silme yok).
"""

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Sequence,
    SmallInteger,
    String,
    Text,
    false,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import RATING_MAX, RATING_MIN
from app.models.base import Base, CreatedAtMixin, IdMixin
from app.models.case_type import CaseType
from app.models.department import Department
from app.models.enums import ActorType, CaseCategory, CaseStatus, Priority
from app.models.location import Location

# case_number icin; id'den bagimsiz olsun ki numara tahmin/siralama bilgisi id'ye baglanmasin
CASE_NUMBER_SEQUENCE = Sequence("case_number_seq")

# Olasilik/guven skorlari 0.000-1.000
SCORE = Numeric(4, 3)
_status_enum = Enum(CaseStatus, name="case_status")


class Case(IdMixin, CreatedAtMixin, Base):
    __tablename__ = "cases"
    __table_args__ = (
        Index("ix_cases_organization_id_status", "organization_id", "status"),
        Index("ix_cases_location_type_created", "location_id", "case_type_id", "created_at"),
        Index("ix_cases_department_id_status", "department_id", "status"),
        Index("ix_cases_reporter_id_created_at", "reporter_id", text("created_at DESC")),
        CheckConstraint(
            "satisfaction_rating IS NULL OR "
            f"satisfaction_rating BETWEEN {RATING_MIN} AND {RATING_MAX}",
            name="satisfaction_rating_range",
        ),
    )

    organization_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("organizations.id"))
    case_number: Mapped[str] = mapped_column(String(20), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    reporter_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    location_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("locations.id"))
    status: Mapped[CaseStatus] = mapped_column(_status_enum)

    # Analiz ve yonlendirme sonrasi dolar (agent'lar ya da manager)
    case_type_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("case_types.id"))
    category: Mapped[CaseCategory | None] = mapped_column(
        Enum(CaseCategory, name="case_category", create_type=False)
    )
    department_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("departments.id"))
    priority: Mapped[Priority | None] = mapped_column(
        Enum(Priority, name="priority", create_type=False)
    )
    impact_score: Mapped[int | None] = mapped_column(SmallInteger)
    confidence_score: Mapped[Decimal | None] = mapped_column(SCORE)
    verification_score: Mapped[Decimal | None] = mapped_column(SCORE)
    # Aktif task'in atanan kisisi (denormalize; tasks tablosu E4'te)
    assigned_staff_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("users.id"), index=True
    )
    parent_case_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("cases.id"))
    duplicate_count: Mapped[int] = mapped_column(Integer, server_default="0")
    needs_human_review: Mapped[bool] = mapped_column(Boolean, server_default=false())
    # SLA gecikme seviyesi; status'tan bagimsizdir (docs/WORKFLOW.md)
    escalation_level: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    reopened_count: Mapped[int] = mapped_column(Integer, server_default="0")
    satisfaction_rating: Mapped[int | None] = mapped_column(SmallInteger)
    satisfaction_comment: Mapped[str | None] = mapped_column(Text)
    # Demo verisini ayirt etmek icin
    is_seed: Mapped[bool] = mapped_column(Boolean, server_default=false())

    classified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Yanitta ozet olarak doner (CaseRead); listelerde selectinload ile tek sorguda gelir
    location: Mapped[Location] = relationship(lazy="raise")
    case_type: Mapped[CaseType | None] = relationship(lazy="raise")
    department: Mapped[Department | None] = relationship(lazy="raise")


class CaseEvent(IdMixin, Base):
    __tablename__ = "case_events"
    __table_args__ = (
        Index("ix_case_events_case_id_occurred_at", "case_id", "occurred_at"),
        Index("ix_case_events_event_type_occurred_at", "event_type", "occurred_at"),
    )

    case_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("cases.id"))
    # varchar: olay tipi listesi buyudukce migration gerekmesin (app/models/enums.py CaseEventType)
    event_type: Mapped[str] = mapped_column(String(50))
    actor_type: Mapped[ActorType] = mapped_column(Enum(ActorType, name="actor_type"))
    actor_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"))
    agent_name: Mapped[str | None] = mapped_column(String(50))
    from_status: Mapped[CaseStatus | None] = mapped_column(
        Enum(CaseStatus, name="case_status", create_type=False)
    )
    to_status: Mapped[CaseStatus | None] = mapped_column(
        Enum(CaseStatus, name="case_status", create_type=False)
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
