"""FAZ 6 analitik sozlesmesi (docs/ANALYTICS.md, docs/API.md "Analytics"). Sureler dakika, oranlar
yuzde (0-100). Deger hesaplanamiyorsa (veri yok) null doner; ekran "-" gosterir.
"""

from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from app.agents.analytics_summary import Sentence, SummaryInput, SummarySource
from app.models.enums import CaseCategory, Priority
from app.schemas.case import CaseTypeSummary, DepartmentSummary, LocationSummary


class PeriodRead(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    start: date = Field(alias="from")
    end: date = Field(alias="to")


class KpiValue(BaseModel):
    """Kart degeri ve onceki esit uzunluktaki donemle karsilastirma."""

    value: float | None
    previous: float | None
    # (value - previous) / previous * 100; onceki 0 ya da yoksa null
    delta_pct: float | None


class KpisRead(BaseModel):
    """docs/ANALYTICS.md bolum 1. Dashboard ustundeki kartlar."""

    period: PeriodRead
    total_cases: KpiValue
    open_cases: KpiValue
    closed_cases: KpiValue
    cases_today: KpiValue
    avg_resolution_min: KpiValue
    median_resolution_min: KpiValue
    median_first_response_min: KpiValue
    median_assignment_min: KpiValue
    sla_compliance_pct: KpiValue
    sla_breach_pct: KpiValue
    reopen_pct: KpiValue
    # Agent'larin insan dokunmadan atadigi bildirim orani
    automation_pct: KpiValue
    human_review_pct: KpiValue


class Granularity(StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class TrendPoint(BaseModel):
    # Kova baslangici (gun / hafta pazartesi / ay ilk gunu), Europe/Istanbul
    bucket: date
    opened: int
    closed: int


class TrendRead(BaseModel):
    granularity: Granularity
    points: list[TrendPoint]


class CaseTypeCount(BaseModel):
    code: str
    name: str
    count: int


class CategoryShare(BaseModel):
    category: CaseCategory
    # Turkce ad ("Temizlik")
    label: str
    count: int
    case_types: list[CaseTypeCount]


class CategoriesRead(BaseModel):
    total: int
    items: list[CategoryShare]


class LocationLevel(StrEnum):
    BUILDING = "building"
    FLOOR = "floor"
    AREA = "area"


class LocationLoad(BaseModel):
    location: LocationSummary
    count: int
    # Isi haritasi: bina x kategori
    by_category: dict[CaseCategory, int]


class LocationsRead(BaseModel):
    level: LocationLevel
    items: list[LocationLoad]


class ResolutionTimeRow(BaseModel):
    category: CaseCategory
    label: str
    count: int
    avg_min: float | None
    median_min: float | None
    p90_min: float | None


class ResolutionTimesRead(BaseModel):
    items: list[ResolutionTimeRow]


class SlaPriorityRow(BaseModel):
    priority: Priority
    with_sla: int
    met: int
    breached: int
    compliance_pct: float | None


class SlaRead(BaseModel):
    with_sla: int
    met: int
    breached: int
    compliance_pct: float | None
    by_priority: list[SlaPriorityRow]


class AgingBucket(BaseModel):
    # "0-2 sa", "24+ sa"
    label: str
    min_hours: int
    # Son kova icin null
    max_hours: int | None
    count: int


class AgingRead(BaseModel):
    total_open: int
    buckets: list[AgingBucket]


class DepartmentPerformance(BaseModel):
    department: DepartmentSummary
    cases: int
    avg_resolution_min: float | None
    median_resolution_min: float | None
    sla_compliance_pct: float | None
    open_tasks: int
    active_staff: int
    open_tasks_per_staff: float | None


class DepartmentsRead(BaseModel):
    items: list[DepartmentPerformance]


class TrendDirection(StrEnum):
    UP = "up"
    FLAT = "flat"
    DOWN = "down"


class RecurringProblem(BaseModel):
    """Ayni yer + ayni tur, pencere icinde esik ve ustu.

    Ornek: B Blok 2. Kat Erkek WC - sabun bitti - 17 bildirim.
    """

    location: LocationSummary
    case_type: CaseTypeSummary
    count: int
    last_reported_at: datetime
    avg_resolution_min: float | None
    # Pencerenin ikinci yarisi ilk yarisina gore
    trend: TrendDirection
    # Turkce oneri: "Kalici cozum (dispenser kapasitesi / periyodik kontrol) degerlendirilebilir."
    suggestion: str


class RecurringRead(BaseModel):
    threshold: int
    window_days: int
    items: list[RecurringProblem]


class ProcessStep(BaseModel):
    """Olay kaydinda ardisik iki adim arasi sure (ornek: TASK_CREATED -> TASK_ACCEPTED)."""

    from_event: str
    to_event: str
    # Turkce ad ("Atamadan kabule")
    label: str
    count: int
    avg_min: float | None
    median_min: float | None


class ProcessRead(BaseModel):
    steps: list[ProcessStep]
    # En uzun medyanli adim (darbogaz); veri yoksa null
    bottleneck: ProcessStep | None


class SummaryPeriod(StrEnum):
    WEEK = "7d"
    MONTH = "30d"


class SummaryRequest(BaseModel):
    period: SummaryPeriod = SummaryPeriod.WEEK


class SummaryRead(BaseModel):
    """AI yonetim ozeti (E5-12): KPI JSON'u ve ondan uretilen metin."""

    kpis: SummaryInput
    text: str
    source: SummarySource
    sentences: list[Sentence]


class AgentMetric(BaseModel):
    agent: str
    label: str
    decisions: int
    avg_confidence: float | None
    # decision_feedback / karar sayisi (yuzde)
    override_rate_pct: float | None


class AgentMetricsRead(BaseModel):
    """docs/ANALYTICS.md bolum 3: agent performansi (/manager/agents)."""

    period: PeriodRead
    automation_pct: float | None
    human_review_pct: float | None
    classification_accuracy_pct: float | None
    duplicate_precision_pct: float | None
    agents: list[AgentMetric]
