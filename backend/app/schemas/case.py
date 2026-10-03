"""Bildirim (case) sozlesmesi, FAZ 3 (docs/API.md "Cases", docs/DATABASE.md "cases")."""

import uuid
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
    OverrideField,
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
    # MERGED ise bagli oldugu ana bildirim
    parent_case_id: int | None
    # Bu bildirime baglanan (ayni sorunu bildiren) bildirim sayisi
    duplicate_count: int
    reopened_count: int
    # Kapanista bildirim yapanin verdigi puan (1-5)
    satisfaction_rating: int | None
    # NEEDS_INFO iken bildirim yapana sorulan soru; diger durumlarda null
    info_request: str | None
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


def _not_blank(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("Metin boş olamaz.")
    return stripped


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=COMMENT_MAX_LENGTH)
    # Ic not: yalniz personel ve mudur yazar/gorur; bildirim yapan goremez
    is_internal: bool = False

    _strip_body = field_validator("body")(_not_blank)


class InfoRequestCreate(BaseModel):
    """Manager bildirim yapana soru sorar (ANALYZING -> NEEDS_INFO)."""

    question: str = Field(min_length=1, max_length=COMMENT_MAX_LENGTH)

    _strip_question = field_validator("question")(_not_blank)


class InfoReplyCreate(BaseModel):
    """Bildirim yapanin yaniti; herkese acik yorum olarak da kaydedilir."""

    body: str = Field(min_length=1, max_length=COMMENT_MAX_LENGTH)

    _strip_body = field_validator("body")(_not_blank)


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


class AgentDecisionRead(BaseModel):
    """Agent karari (docs/DATABASE.md "agent_decisions"); yalniz manager ve admin gorur."""

    id: int
    run_id: uuid.UUID
    agent_name: str
    decision: str
    confidence: float | None
    reasons: list[dict[str, Any]] = Field(validation_alias=AliasChoices("reason_json", "reasons"))
    output: dict[str, Any] = Field(validation_alias=AliasChoices("output_json", "output"))
    model: str
    latency_ms: int
    created_at: datetime
    # Turkce basliklar: "Siniflandirma" / "Sabun bitti"; bilinmiyorsa bos (kod gosterilir)
    agent_label: str | None = None
    decision_label: str | None = None


# Duzeltilen deger bir kod: tur (SOAP_EMPTY), oncelik (HIGH) ya da birim (SUPPORT_SERVICES)
OVERRIDE_VALUE_MAX_LENGTH = 100


class OverrideRequest(BaseModel):
    """Manager agent kararini duzeltir (E5-9); gerekce zorunlu, yeniden egitim verisi olur."""

    field: OverrideField
    corrected_value: str = Field(min_length=1, max_length=OVERRIDE_VALUE_MAX_LENGTH)
    reason: str = Field(min_length=1, max_length=REOPEN_REASON_MAX_LENGTH)

    _strip_reason = field_validator("reason")(_not_blank)


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=REOPEN_REASON_MAX_LENGTH)

    _strip_reason = field_validator("reason")(_not_blank)


class CloseRequest(BaseModel):
    """Manager tamamlanan isi dogrular (VERIFICATION -> CLOSED, E5-11)."""

    reason: str = Field(min_length=1, max_length=REOPEN_REASON_MAX_LENGTH)

    _strip_reason = field_validator("reason")(_not_blank)


class MergeRequest(BaseModel):
    """Manager bildirimi ayni sorunun ana bildirimine baglar (E5-6); duzeltme verisi olur."""

    parent_case_id: int
    reason: str = Field(min_length=1, max_length=REOPEN_REASON_MAX_LENGTH)

    _strip_reason = field_validator("reason")(_not_blank)


class CaseRef(BaseModel):
    id: int
    case_number: str
    title: str


class ReviewItemRead(BaseModel):
    """Inceleme kuyrugu satiri: AI onerisi (case icinde), guven ve neden buraya dustugu."""

    case: CaseRead
    # Supervisor kurali (RULE_3_ESCALATE...) ya da Resolution gerekcesi (NOTE_TOO_SHORT, NOT_DONE);
    # personel reddettiyse ya da agent kapaliyken bos
    reason_code: str | None
    reason: str | None
    # Siniflandirma guveni (0-1)
    confidence: float | None
    # Duplicate Agent'in "ayni sorun olabilir" dedigi bildirim (0.60-0.80); yoksa bos
    possible_duplicate_of: CaseRef | None = None
