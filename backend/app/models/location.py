from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Enum,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import IMPORTANCE_WEIGHT_MAX, IMPORTANCE_WEIGHT_MIN
from app.models.base import Base, IdMixin
from app.models.enums import LocationKind


class Location(IdMixin, Base):
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("organization_id", "code"),
        CheckConstraint(
            f"importance_weight BETWEEN {IMPORTANCE_WEIGHT_MIN} AND {IMPORTANCE_WEIGHT_MAX}",
            name="importance_weight_range",
        ),
        # Bina/kat analizi "path LIKE 'KMP/B/%'" ile yapilir; pattern_ops prefix aramasi icin
        Index(
            "ix_locations_path",
            "path",
            postgresql_ops={"path": "varchar_pattern_ops"},
        ),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), index=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("locations.id"), index=True
    )
    kind: Mapped[LocationKind] = mapped_column(Enum(LocationKind, name="location_kind"))
    code: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(200))
    # Materialized path: KMP/B/B-2/B-2-WCM
    path: Mapped[str] = mapped_column(String(500))
    importance_weight: Mapped[int] = mapped_column(SmallInteger)
    # Intake eslestirmesi icin serbest metin takma adlari
    aliases: Mapped[list[Any]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())
