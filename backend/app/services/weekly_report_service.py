"""Haftalik yonetici raporu (PDF): pazartesi-pazar haftasinin ozeti, mudur indirir.

Hesap yapilmaz: ekrandaki raporlarin servisleri (KPI, birim, tekrar eden sorun, gecikme riski,
yonetim ozeti) ayni sekilde cagrilir; burada yalniz secim ve Turkce bicim vardir. Gecikme riski
anliktir (raporun olusturuldugu an), diger bolumler secilen haftaya aittir.
"""

import math
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.analytics.scope import TURKEY, AnalyticsFilter
from app.core.clock import Clock
from app.models import Organization, User
from app.reports.weekly_model import KpiLine, WeeklyReport
from app.schemas.analytics import DelayRiskLevel, KpisRead, KpiValue
from app.services.analytics_service import AnalyticsService
from app.services.delay_risk_service import DelayRiskService
from app.services.operations_analytics_service import OperationsAnalyticsService
from app.services.summary_service import SummaryService

DAYS_PER_WEEK = 7
SUNDAY = 6
MINUTES_PER_HOUR = 60
HOURS_PER_DAY = 24
# Raporda gosterilen en fazla satir: tek sayfaya sigsin
RECURRING_LIMIT = 5
RISK_LIMIT = 5
MONTHS = (
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
)  # fmt: skip
NO_VALUE = "-"


def week_of(day: date) -> tuple[date, date]:
    monday = day - timedelta(days=day.weekday())
    return monday, monday + timedelta(days=DAYS_PER_WEEK - 1)


def last_full_week(today: date) -> tuple[date, date]:
    """Bugun pazar degilse icinde bulunulan hafta bitmemistir: bir onceki hafta."""
    return week_of(today - timedelta(days=today.weekday() + 1))


def period_label(first: date, last: date) -> str:
    end = f"{last.day} {MONTHS[last.month - 1]} {last.year}"
    if first.month == last.month:
        return f"{first.day} - {end}"
    return f"{first.day} {MONTHS[first.month - 1]} - {end}"


def fmt_minutes(minutes: float | None) -> str:
    if minutes is None:
        return NO_VALUE
    total = round(minutes)
    hours, rest = divmod(total, MINUTES_PER_HOUR)
    if hours >= HOURS_PER_DAY:
        days, hours = divmod(hours, HOURS_PER_DAY)
        return f"{days} gün {hours} sa"
    return f"{hours} sa {rest} dk" if hours else f"{rest} dk"


def fmt_pct(value: float | None) -> str:
    return NO_VALUE if value is None else f"%{round(value)}"


def fmt_change(delta_pct: float | None) -> str:
    if delta_pct is None:
        return NO_VALUE
    sign = "+" if delta_pct >= 0 else "-"
    return f"{sign}%{math.floor(abs(delta_pct) + 0.5)}"


def _count(value: float | None) -> str:
    return NO_VALUE if value is None else str(round(value))


def _kpi_lines(kpis: KpisRead) -> list[KpiLine]:
    def line(label: str, kpi: KpiValue, fmt: Callable[[float | None], str] = _count) -> KpiLine:
        return KpiLine(label, fmt(kpi.value), fmt(kpi.previous), fmt_change(kpi.delta_pct))

    return [
        line("Açılan bildirim", kpis.total_cases),
        line("Kapanan bildirim", kpis.closed_cases),
        line("Ortalama çözüm süresi", kpis.avg_resolution_min, fmt_minutes),
        line("SLA uyumu", kpis.sla_compliance_pct, fmt_pct),
        line("Otomasyon oranı", kpis.automation_pct, fmt_pct),
        line("Müdür incelemesi oranı", kpis.human_review_pct, fmt_pct),
    ]


@dataclass(frozen=True)
class ReportSources:
    analytics: AnalyticsService
    operations: OperationsAnalyticsService
    delay_risk: DelayRiskService
    summary: SummaryService


class WeeklyReportService:
    def __init__(self, session: Session, actor: User, sources: ReportSources, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._sources = sources
        self._clock = clock

    def default_week(self) -> tuple[date, date]:
        return last_full_week(self._clock.now().astimezone(TURKEY).date())

    def pdf(self, first: date, last: date) -> bytes:
        # fpdf2 ~50 MB: yalniz rapor istenince yuklenir (Render 512 MB)
        from app.reports.weekly_pdf import render

        return render(self.build(first, last))

    def build(self, first: date, last: date) -> WeeklyReport:
        filters = AnalyticsFilter(first, last, None, None)
        sources = self._sources
        organization = self._session.get(Organization, self._actor.organization_id)
        return WeeklyReport(
            organization=organization.name if organization else "",
            period=period_label(first, last),
            generated_at=self._clock.now(),
            summary=sources.summary.summarize_days(first, last).text,
            kpis=_kpi_lines(sources.analytics.kpis(filters)),
            departments=[
                (
                    row.department.name,
                    str(row.cases),
                    fmt_minutes(row.median_resolution_min),
                    fmt_pct(row.sla_compliance_pct),
                    str(row.open_tasks),
                )
                for row in sources.operations.departments(filters).items
            ],
            recurring=[
                (item.location.name, item.case_type.name, str(item.count), item.suggestion)
                for item in sources.operations.recurring(filters).items[:RECURRING_LIMIT]
            ],
            risks=[
                (
                    item.case_number,
                    item.title,
                    item.department_name or NO_VALUE,
                    fmt_pct(item.risk_pct),
                )
                for item in sources.delay_risk.read(filters).items
                if item.level is DelayRiskLevel.HIGH
            ][:RISK_LIMIT],
        )
