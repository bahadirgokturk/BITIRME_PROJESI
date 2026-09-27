"""Bildirim (case) sozlesmesi, FAZ 3 (docs/API.md "Cases", docs/DATABASE.md "cases")."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.core.constants import (
    CASE_DESCRIPTION_MAX_LENGTH,
    CASE_DESCRIPTION_MIN_LENGTH,
    CASE_TITLE_MAX_LENGTH,
)
from app.models.enums import ActorType, CaseCategory, CaseStatus, LocationKind, Priority


class CaseCreate(BaseModel):
    """Bildirim formu. Tur, birim ve oncelik kullanicidan istenmez; agent'lar belirler."""

    description: str = Field(
        min_length=CASE_DESCRIPTION_MIN_LENGTH, max_length=CASE_DESCRIPTION_MAX_LENGTH
    )
    location_id: int
    # Bos birakilirsa aciklamanin basindan uretilir
    title: str | None = Field(default=None, min_length=1, max_length=CASE_TITLE_MAX_LENGTH)


class CaseTypeSummary(BaseModel):
    id: int
    code: str
    name: str


class LocationSummary(BaseModel):
    id: int
    kind: LocationKind
    name: str
    path: str


class DepartmentSummary(BaseModel):
    id: int
    code: str
    name: str


class CaseRead(BaseModel):
    id: int
    # Kullaniciya gosterilen numara: CASE-000124
    case_number: str
    title: str
    description: str
    status: CaseStatus
    location: LocationSummary
    reporter_id: int
    # Analizden once bos; agent'lar ya da manager doldurur
    case_type: CaseTypeSummary | None
    category: CaseCategory | None
    department: DepartmentSummary | None
    priority: Priority | None
    needs_human_review: bool
    reopened_count: int
    created_at: datetime
    assigned_at: datetime | None
    resolved_at: datetime | None
    closed_at: datetime | None
    # SLA cozum hedefi (FAZ 4)
    due_at: datetime | None


class CaseEventRead(BaseModel):
    """Zaman cizelgesi satiri. Olay tipleri: docs/WORKFLOW.md bolum 3."""

    id: int
    event_type: str
    actor_type: ActorType
    actor_id: int | None
    agent_name: str | None
    from_status: CaseStatus | None
    to_status: CaseStatus | None
    occurred_at: datetime
    metadata: dict[str, Any]
