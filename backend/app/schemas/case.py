"""Bildirim (case) sozlesmesi, FAZ 3 (docs/API.md "Cases", docs/DATABASE.md "cases")."""

from datetime import datetime
from typing import Any

from pydantic import AliasChoices, BaseModel, Field, field_validator

from app.core.constants import (
    CASE_DESCRIPTION_MAX_LENGTH,
    CASE_DESCRIPTION_MIN_LENGTH,
    CASE_TITLE_MAX_LENGTH,
    COMMENT_MAX_LENGTH,
    RATING_MAX,
    RATING_MIN,
    REOPEN_REASON_MAX_LENGTH,
)
from app.models.enums import (
    ActorType,
    CaseCategory,
    CaseStatus,
    LocationKind,
    Priority,
    SlaStatus,
    UserRole,
)


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
    # Kapanista bildirim yapanin verdigi puan (1-5)
    satisfaction_rating: int | None
    created_at: datetime
    assigned_at: datetime | None
    resolved_at: datetime | None
    closed_at: datetime | None
    # SLA cozum hedefi ve okuma aninda hesaplanan durumu (FAZ 4, E4-2)
    due_at: datetime | None
    sla_status: SlaStatus | None = None


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
    # Modelde metadata_json (SQLAlchemy'de 'metadata' ayrilmis bir addir)
    metadata: dict[str, Any] = Field(validation_alias=AliasChoices("metadata_json", "metadata"))


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=COMMENT_MAX_LENGTH)
    # Ic not: yalniz personel ve mudur yazar/gorur; bildirim yapan goremez
    is_internal: bool = False

    @field_validator("body")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Yorum boş olamaz.")
        return stripped


class CommentRead(BaseModel):
    id: int
    case_id: int
    body: str
    is_internal: bool
    author_id: int
    author_name: str
    author_role: UserRole
    created_at: datetime


class FeedbackCreate(BaseModel):
    rating: int = Field(ge=RATING_MIN, le=RATING_MAX)
    comment: str | None = Field(default=None, max_length=COMMENT_MAX_LENGTH)


class ReopenRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=REOPEN_REASON_MAX_LENGTH)
