"""Admin tanimlari: bildirim turleri, SLA kurallari, agent politikalari (docs/API.md "Admin").

PATCH semasinda gonderilmeyen alan degismez. Zorunlu bir alana null gonderilirse yok sayilir;
yalniz birim alanlari null ile bosaltilabilir (services/catalog_service.py CASE_TYPE_NULLABLE).
"""

from typing import Annotated, Self

from pydantic import BaseModel, Field, model_validator

from app.core.constants import (
    CASE_TYPE_KEYWORD_MAX_LENGTH,
    CASE_TYPE_NAME_MAX_LENGTH,
    PERCENT,
    SEVERITY_MAX,
    SEVERITY_MIN,
    SLA_WARNING_PCT_DEFAULT,
)
from app.models.enums import AutonomyLevel, CaseCategory, PolicyScope, Priority

# Kod: buyuk harf, rakam, alt cizgi (seed ve Classification Agent etiketleriyle ayni bicim)
CODE_PATTERN = r"^[A-Z0-9_]+$"
CODE_MAX_LENGTH = 50
Keyword = Annotated[str, Field(min_length=1, max_length=CASE_TYPE_KEYWORD_MAX_LENGTH)]


class CaseTypeAdminRead(BaseModel):
    id: int
    code: str
    name: str
    category: CaseCategory
    default_department_id: int | None
    secondary_department_id: int | None
    base_priority: Priority
    base_severity: int
    is_safety_related: bool
    keywords: list[str]
    is_active: bool


class CaseTypeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=CODE_MAX_LENGTH, pattern=CODE_PATTERN)
    name: str = Field(min_length=1, max_length=CASE_TYPE_NAME_MAX_LENGTH)
    category: CaseCategory
    default_department_id: int | None = None
    secondary_department_id: int | None = None
    base_priority: Priority
    base_severity: int = Field(ge=SEVERITY_MIN, le=SEVERITY_MAX)
    is_safety_related: bool = False
    keywords: list[Keyword] = []


class CaseTypeUpdate(BaseModel):
    """Kod degismez: gecmis kararlar ve model etiketleri koda baglidir."""

    name: str | None = Field(default=None, min_length=1, max_length=CASE_TYPE_NAME_MAX_LENGTH)
    category: CaseCategory | None = None
    default_department_id: int | None = None
    secondary_department_id: int | None = None
    base_priority: Priority | None = None
    base_severity: int | None = Field(default=None, ge=SEVERITY_MIN, le=SEVERITY_MAX)
    is_safety_related: bool | None = None
    keywords: list[Keyword] | None = None
    is_active: bool | None = None


class SlaRuleRead(BaseModel):
    id: int
    # Bos: o oncelik icin varsayilan kural
    case_type_id: int | None
    priority: Priority
    response_minutes: int
    resolution_minutes: int
    warning_threshold_pct: int
    is_active: bool


class SlaRuleCreate(BaseModel):
    case_type_id: int | None = None
    priority: Priority
    response_minutes: int = Field(gt=0)
    resolution_minutes: int = Field(gt=0)
    warning_threshold_pct: int = Field(default=SLA_WARNING_PCT_DEFAULT, ge=1, le=PERCENT - 1)

    @model_validator(mode="after")
    def _resolution_after_response(self) -> Self:
        ensure_resolution_after_response(self.response_minutes, self.resolution_minutes)
        return self


class SlaRuleUpdate(BaseModel):
    """Hedef (tur, oncelik) degismez; baska hedef icin yeni kural acilir."""

    response_minutes: int | None = Field(default=None, gt=0)
    resolution_minutes: int | None = Field(default=None, gt=0)
    warning_threshold_pct: int | None = Field(default=None, ge=1, le=PERCENT - 1)
    is_active: bool | None = None


class AgentPolicyRead(BaseModel):
    id: int
    scope: PolicyScope
    case_type_id: int | None
    category: CaseCategory | None
    autonomy_level: AutonomyLevel
    min_confidence_auto: float
    notify_manager: bool
    is_active: bool


class AgentPolicyUpdate(BaseModel):
    autonomy_level: AutonomyLevel | None = None
    min_confidence_auto: float | None = Field(default=None, ge=0, le=1)
    notify_manager: bool | None = None


def ensure_resolution_after_response(response_minutes: int, resolution_minutes: int) -> None:
    # Cozum hedefi kabul hedefinden once dolamaz (ValueError -> 422)
    if resolution_minutes < response_minutes:
        raise ValueError("resolution_minutes, response_minutes'tan kucuk olamaz")
