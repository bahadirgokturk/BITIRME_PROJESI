"""Analitik ve agent metrikleri (FAZ 6, MANAGER ve ADMIN).

Bildirim KPI'lari ve dagilimlari calisir (E6-2, E6-3; app/services/analytics_service.py). Birim
performansi, tekrarlayan sorunlar, surec, ozet ve agent metrikleri henuz sozlesme (501).

Ortak filtre: from, to (Europe/Istanbul gunleri, ikisi dahil), department_id, building_id.
"""

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.analytics.scope import TURKEY, AnalyticsFilter
from app.api.deps import CurrentUser, require_roles
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.database import get_session
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
from app.services.analytics_service import AnalyticsService

# Varsayilan donem: son 7 gun; en uzun donem bir yil (sorgu suresi ve grafik okunurlugu)
DEFAULT_PERIOD_DAYS = 7
MAX_PERIOD_DAYS = 366

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


def get_analytics_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
) -> AnalyticsService:
    return AnalyticsService(session, user, clock)


Analytics = Annotated[AnalyticsService, Depends(get_analytics_service)]


@router.get("/kpis")
def kpis(filters: Filter, service: Analytics) -> KpisRead:
    """KPI kartlari; her biri onceki esit uzunluktaki donemle karsilastirilir."""
    return service.kpis(filters)


@router.get("/trend")
def trend(
    filters: Filter, service: Analytics, granularity: Granularity = Granularity.DAY
) -> TrendRead:
    """Acilan ve kapanan bildirim serileri."""
    return service.trend(filters, granularity)


@router.get("/categories")
def categories(filters: Filter, service: Analytics) -> CategoriesRead:
    """Kategori -> tur dagilimi."""
    return service.categories(filters)


@router.get("/locations")
def locations(
    filters: Filter, service: Analytics, level: LocationLevel = LocationLevel.BUILDING
) -> LocationsRead:
    """Bina/kat/alan bazinda yogunluk ve kategori kirilimi (isi haritasi)."""
    return service.locations(filters, level)


@router.get("/resolution-times")
def resolution_times(filters: Filter, service: Analytics) -> ResolutionTimesRead:
    """Kategori bazinda ortalama, medyan ve p90 cozum suresi."""
    return service.resolution_times(filters)


@router.get("/sla")
def sla(filters: Filter, service: Analytics) -> SlaRead:
    """SLA uyumu ve ihlali, oncelik kirilimiyla."""
    return service.sla(filters)


@router.get("/aging")
def aging(filters: Filter, service: Analytics) -> AgingRead:
    """Acik bildirimlerin yas kovalari (0-2, 2-6, 6-12, 12-24, 24+ saat)."""
    return service.aging(filters)


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
