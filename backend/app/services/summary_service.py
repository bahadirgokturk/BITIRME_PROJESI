"""AI yonetim ozeti (E5-12 agent'i + E6-2 KPI'lari; docs/ANALYTICS.md bolum 5).

Ozet girdisi dashboard'daki uclarla ayni servislerden gelir; agent yalniz bu JSON'dan metin uretir,
veritabanina dokunmaz. Kurum geneli: birim/bina filtresi yoktur.
"""

import math
from datetime import timedelta

from app.agents.analytics_summary import (
    AnalyticsSummaryAgent,
    CategoryCount,
    LocationCount,
    Period,
    RecurringProblem,
    SlowDepartment,
    SummaryInput,
)
from app.agents.base import AgentContext
from app.analytics.scope import TURKEY, AnalyticsFilter
from app.core.clock import Clock
from app.schemas.analytics import (
    DepartmentsRead,
    LocationLevel,
    RecurringRead,
    SummaryPeriod,
    SummaryRead,
)
from app.services.analytics_service import AnalyticsService
from app.services.operations_analytics_service import OperationsAnalyticsService

PERIOD_DAYS = {SummaryPeriod.WEEK: 7, SummaryPeriod.MONTH: 30}


# Yarim degerler yukari: frontend Math.round ile ayni (Python round 68.5 -> 68 verir, ekran %69)
_HALF = 0.5


def screen_round(value: float | None) -> int | None:
    """Ozet metninde yuzde ve dakika tam sayi okunur ("%82", "135 dk"); ekrandaki kutuyla ayni."""
    return None if value is None else math.floor(value + _HALF)


def _slowest(departments: DepartmentsRead) -> SlowDepartment | None:
    measured = [row for row in departments.items if row.median_resolution_min is not None]
    if not measured:
        return None
    slowest = max(measured, key=lambda row: row.median_resolution_min or 0)
    return SlowDepartment(
        name=slowest.department.name,
        median_resolution_min=screen_round(slowest.median_resolution_min) or 0,
    )


def _recurring(report: RecurringRead) -> list[RecurringProblem]:
    return [
        RecurringProblem(
            location=item.location.name,
            type=item.case_type.code,
            type_name=item.case_type.name,
            count=item.count,
        )
        for item in report.items
    ]


class SummaryService:
    def __init__(
        self,
        reports: tuple[AnalyticsService, OperationsAnalyticsService],
        agent: AnalyticsSummaryAgent,
        clock: Clock,
    ) -> None:
        self._analytics, self._operations = reports
        self._agent = agent
        self._clock = clock

    def summarize(self, period: SummaryPeriod) -> SummaryRead:
        inp = self.summary_input(period)
        result = self._agent.run(inp, AgentContext(now=self._clock.now()))
        return SummaryRead(
            kpis=inp,
            text=result.output.text,
            source=result.output.source,
            sentences=result.output.sentences,
        )

    def summary_input(self, period: SummaryPeriod) -> SummaryInput:
        today = self._clock.now().astimezone(TURKEY).date()
        first = today - timedelta(days=PERIOD_DAYS[period] - 1)
        filters = AnalyticsFilter(first, today, None, None)
        kpis = self._analytics.kpis(filters)
        categories = self._analytics.categories(filters).items
        places = self._analytics.locations(filters, LocationLevel.BUILDING).items
        return SummaryInput(
            period=Period(start=first, end=today),
            total_cases=screen_round(kpis.total_cases.value) or 0,
            previous_period_change_pct=screen_round(kpis.total_cases.delta_pct),
            top_category=(
                CategoryCount(code=categories[0].category, count=categories[0].count)
                if categories
                else None
            ),
            highest_problem_location=(
                LocationCount(path=places[0].location.name, count=places[0].count)
                if places
                else None
            ),
            sla_compliance_pct=screen_round(kpis.sla_compliance_pct.value),
            sla_breaches=self._analytics.sla(filters).breached,
            recurring_problems=_recurring(self._operations.recurring(filters)),
            slowest_department=_slowest(self._operations.departments(filters)),
            automation_rate_pct=screen_round(kpis.automation_pct.value),
        )
