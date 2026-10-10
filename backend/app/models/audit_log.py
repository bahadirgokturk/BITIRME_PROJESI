"""Denetim izi (docs/DATABASE.md "audit_logs", E2-5).

Admin tanimlarinda kim, ne zaman, neyi degistirdi.

Yalniz ekleme yapilir. Guncellemede before/after yalniz degisen alanlari tutar; parola hash'i hicbir
zaman yazilmaz (kayit icerigi okuma semalarindan alinir).
"""

from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin


class AuditLog(IdMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        # Liste: kurumun en yeni kayitlari; suzgec: tek bir kaydin gecmisi
        Index("ix_audit_logs_organization_id_created_at", "organization_id", "created_at"),
        Index("ix_audit_logs_entity", "organization_id", "entity_type", "entity_id"),
    )

    organization_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("organizations.id"))
    # Islemi yapan admin
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    # DEPARTMENT_CREATED, SLA_RULE_UPDATED ...
    action: Mapped[str] = mapped_column(String(50))
    entity_type: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[int] = mapped_column(BigInteger)
    before_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    after_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    # IPv6 en fazla 45 karakter
    ip_address: Mapped[str | None] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
