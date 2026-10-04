"""Analitik ve agent metrikleri (FAZ 6, MANAGER ve ADMIN).

Bildirim KPI'lari ve dagilimlari (analytics_service.py), birim performansi, tekrarlayan sorunlar ve
surec (operations_analytics_service.py), AI yonetim ozeti (summary_service.py) ve agent metrikleri
(agent_metrics_service.py). Hesaplar app/analytics altinda; LLM yalniz ozet metnini akicilastirir.

Ortak filtre: from, to (Europe/Istanbul gunleri, ikisi dahil), department_id, building_id.
"""

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.agents.analytics_summary import AnalyticsSummaryAgent
from app.agents.providers.ollama import summary_polisher
from app.analytics.scope import TURKEY, AnalyticsFilter
from app.api.deps import CurrentUser, get_app_settings, require_roles
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.config import Settings
from app.core.database import get_session
from app.core.errors import InvalidPeriodError
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
from app.services.agent_metrics_service import AgentMetricsService
from app.services.analytics_service import AnalyticsService
from app.services.operations_analytics_service import OperationsAnalyticsService
from app.services.summary_service import SummaryService

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


def get_operations_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
) -> OperationsAnalyticsService:
    return OperationsAnalyticsService(session, user, clock)


Operations = Annotated[OperationsAnalyticsService, Depends(get_operations_service)]


def get_summary_service(
    analytics: Analytics,
    operations: Operations,
    settings: Annotated[Settings, Depends(get_app_settings)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> SummaryService:
    # LLM_PROVIDER=none (varsayilan): yalniz sablon metin (docs/AGENTS.md 4.10)
    agent = AnalyticsSummaryAgent(summary_polisher(settings))
    return SummaryService((analytics, operations), agent, clock)


def get_agent_metrics_service(
    session: Annotated[Session, Depends(get_session)], user: CurrentUser
) -> AgentMetricsService:
    return AgentMetricsService(session, user)


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
def departments(filters: Filter, service: Operations) -> DepartmentsRead:
    """Birim performansi: sayi, cozum suresi, SLA uyumu, acik is yuku."""
    return service.departments(filters)


@router.get("/recurring")
def recurring(filters: Filter, service: Operations) -> RecurringRead:
    """Tekrarlayan sorunlar: ayni yer + tur, donem sonuna kadarki 30 gunde esik ve ustu."""
    return service.recurring(filters)


@router.get("/process")
def process(filters: Filter, service: Operations) -> ProcessRead:
    """Olay kaydindan adim sureleri ve darbogaz."""
    return service.process(filters)


@router.post("/summary")
def summary(
    payload: SummaryRequest, service: Annotated[SummaryService, Depends(get_summary_service)]
) -> SummaryRead:
    """AI yonetim ozeti: KPI JSON'u + sablon (opsiyonel yerel LLM) metni."""
    return service.summarize(payload.period)


@agents_router.get("/metrics")
def agent_metrics(
    filters: Filter, service: Annotated[AgentMetricsService, Depends(get_agent_metrics_service)]
) -> AgentMetricsRead:
    """Agent performansi: otomasyon, insan incelemesi, duzeltme orani, siniflandirma dogrulugu."""
    return service.metrics(filters)
