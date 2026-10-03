"""Analitik ve agent metrikleri (FAZ 6, MANAGER ve ADMIN).

Su an yalniz sozlesme: semalar OpenAPI'de, is mantigi E6-2/E6-3/E6-5 ile gelir (PROJECT_PLAN
bolum 1). Parametre dogrulamasi simdiden calisir.

Ortak filtre: from, to (Europe/Istanbul gunleri, ikisi dahil), department_id, building_id.
"""

from dataclasses import dataclass
from datetime import date, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_roles
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.errors import InvalidPeriodError, NotImplementedYetError
from app.models.enums import UserRole
from app.schemas.analytics import (
    AgentMetricsRead,
    AgingRead,
    CategoriesRead,
    DepartmentsRead,
    Granularity,
    KpisRead,
    LocationLevel,
    LocationsRead,
    ProcessRead,
    RecurringRead,
    ResolutionTimesRead,
    SlaRead,
    SummaryRead,
    SummaryRequest,
    TrendRead,
)

# Varsayilan donem: son 7 gun; en uzun donem bir yil (sorgu suresi ve grafik okunurlugu)
DEFAULT_PERIOD_DAYS = 7
MAX_PERIOD_DAYS = 366
# Kampus saati: gun sinirlari Europe/Istanbul (sabit UTC+3, yaz saati yok)
TURKEY = timezone(timedelta(hours=3))

MANAGERS = [Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN))]
router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    responses=AUTHENTICATED_RESPONSES,
    dependencies=MANAGERS,
)
agents_router = APIRouter(
    prefix="/agents", tags=["agents"], responses=AUTHENTICATED_RESPONSES, dependencies=MANAGERS
)


@dataclass(frozen=True)
class AnalyticsFilter:
    start: date
    end: date
    department_id: int | None
    building_id: int | None


def analytics_filter(
    clock: Annotated[Clock, Depends(get_clock)],
    start: Annotated[date | None, Query(alias="from")] = None,
    end: Annotated[date | None, Query(alias="to")] = None,
    department_id: int | None = None,
    building_id: Annotated[int | None, Query(description="Bina lokasyonunun id'si")] = None,
) -> AnalyticsFilter:
    today = clock.now().astimezone(TURKEY).date()
    last = end or today
    first = start or last - timedelta(days=DEFAULT_PERIOD_DAYS - 1)
    if first > last or (last - first).days >= MAX_PERIOD_DAYS:
        raise InvalidPeriodError(MAX_PERIOD_DAYS)
    return AnalyticsFilter(first, last, department_id, building_id)


Filter = Annotated[AnalyticsFilter, Depends(analytics_filter)]


@router.get("/kpis")
def kpis(_filter: Filter) -> KpisRead:
    """KPI kartlari; her biri onceki esit uzunluktaki donemle karsilastirilir."""
    raise NotImplementedYetError()


@router.get("/trend")
def trend(_filter: Filter, granularity: Granularity = Granularity.DAY) -> TrendRead:
    """Acilan ve kapanan bildirim serileri."""
    raise NotImplementedYetError()


@router.get("/categories")
def categories(_filter: Filter) -> CategoriesRead:
    """Kategori -> tur dagilimi."""
    raise NotImplementedYetError()


@router.get("/locations")
def locations(_filter: Filter, level: LocationLevel = LocationLevel.BUILDING) -> LocationsRead:
    """Bina/kat/alan bazinda yogunluk ve kategori kirilimi (isi haritasi)."""
    raise NotImplementedYetError()


@router.get("/resolution-times")
def resolution_times(_filter: Filter) -> ResolutionTimesRead:
    """Kategori bazinda ortalama, medyan ve p90 cozum suresi."""
    raise NotImplementedYetError()


@router.get("/sla")
def sla(_filter: Filter) -> SlaRead:
    """SLA uyumu ve ihlali, oncelik kirilimiyla."""
    raise NotImplementedYetError()


@router.get("/aging")
def aging(_filter: Filter) -> AgingRead:
    """Acik bildirimlerin yas kovalari (0-2, 2-6, 6-12, 12-24, 24+ saat)."""
    raise NotImplementedYetError()


@router.get("/departments")
def departments(_filter: Filter) -> DepartmentsRead:
    """Birim performansi: sayi, cozum suresi, SLA uyumu, acik is yuku."""
    raise NotImplementedYetError()


@router.get("/recurring")
def recurring(_filter: Filter) -> RecurringRead:
    """Tekrarlayan sorunlar: ayni yer + tur, son 30 gunde esik ve ustu."""
    raise NotImplementedYetError()


@router.get("/process")
def process(_filter: Filter) -> ProcessRead:
    """Olay kaydindan adim sureleri ve darbogaz."""
    raise NotImplementedYetError()


@router.post("/summary")
def summary(_payload: SummaryRequest) -> SummaryRead:
    """AI yonetim ozeti: KPI JSON'u + sablon (opsiyonel yerel LLM) metni."""
    raise NotImplementedYetError()


@agents_router.get("/metrics")
def agent_metrics(_filter: Filter) -> AgentMetricsRead:
    """Agent performansi: otomasyon, insan incelemesi, duzeltme orani, siniflandirma dogrulugu."""
    raise NotImplementedYetError()
