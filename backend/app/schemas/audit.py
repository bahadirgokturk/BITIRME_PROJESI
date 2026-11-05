"""Denetim izi okuma semasi (GET /admin/audit-logs)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.enums import AuditEntity


class AuditLogRead(BaseModel):
    id: int
    action: str
    entity_type: AuditEntity
    entity_id: int
    actor_id: int
    actor_name: str
    # Eklemede before bos, after tam kayit; guncellemede ikisi de yalniz degisen alanlar
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime


class AuditLogFilter(BaseModel):
    entity_type: AuditEntity | None = None
    entity_id: int | None = None
