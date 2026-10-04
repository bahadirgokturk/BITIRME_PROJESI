"""Operasyon raporlari (E6-3): birim performansi, tekrarlayan sorunlar, surec darbogazi.

Kapsam ve filtre kurallari AnalyticsService ile ayni (resolve_scope).
"""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.orm import Session

from app.analytics import durations, process, recurring, workload
from app.analytics.case_kpis import DurationStats, percent, rounded
from app.analytics.durations import SlaCounts
from app.analytics.scope import AnalyticsFilter, days
from app.core.clock import Clock
from app.core.constants import RECURRING_MIN_COUNT, RECURRING_WINDOW_DAYS
from app.core.messages import RECURRING_SUGGESTIONS
from app.models import Case, Department, User
from app.repositories import department_repository
from app.schemas.analytics import (
    DepartmentPerformance,
    DepartmentsRead,
    ProcessRead,
    ProcessStep,
    RecurringProblem,
    RecurringRead,
)
from app.schemas.case import CaseTypeSummary, DepartmentSummary, LocationSummary
from app.services.analytics_service import resolve_scope

_NO_DURATION = DurationStats(0, None, None, None)


@dataclass(frozen=True)
class _DepartmentFacts:
    cases: dict[int, int]
    resolution: dict[int, DurationStats]
    sla: dict[int, SlaCounts]
    open_tasks: dict[int, int]
    staff: dict[int, int]

    def performance(self, department: Department) -> DepartmentPerformance:
        stats = self.resolution.get(department.id, _NO_DURATION)
        sla = self.sla.get(department.id, SlaCounts(0, 0))
        open_tasks = self.open_tasks.get(department.id, 0)
        staff = self.staff.get(department.id, 0)
        return DepartmentPerformance(
            department=DepartmentSummary.model_validate(department, from_attributes=True),
            cases=self.cases.get(department.id, 0),
            avg_resolution_min=stats.avg,
            median_resolution_min=stats.median,
            sla_compliance_pct=percent(sla.met, sla.with_sla),
            open_tasks=open_tasks,
            active_staff=staff,
            # Personeli olmayan birimde oran tanimsiz (sifira bolme degil "-")
            open_tasks_per_staff=rounded(open_tasks / staff) if staff else None,
        )


def _step(stats: process.StepStats) -> ProcessStep:
    return ProcessStep(
        from_event=stats.step.start,
        to_event=stats.step.end,
        label=stats.step.label,
        count=stats.count,
        avg_min=stats.avg_min,
        median_min=stats.median_min,
    )


def _problem(row: recurring.RecurringRow) -> RecurringProblem:
    return RecurringProblem(
        location=LocationSummary.model_validate(row.location, from_attributes=True),
        case_type=CaseTypeSummary.model_validate(row.case_type, from_attributes=True),
        count=row.count,
        last_reported_at=row.last_reported_at,
        avg_resolution_min=row.avg_resolution_min,
        trend=row.trend,
        suggestion=RECURRING_SUGGESTIONS[row.case_type.category.value],
    )


class OperationsAnalyticsService:
    def __init__(self, session: Session, actor: User, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock

    def departments(self, filters: AnalyticsFilter) -> DepartmentsRead:
        """Kurumun aktif birimleri; bildirimi olmayan birim de satir olarak gorunur."""
        scope = resolve_scope(self._session, self._actor, filters)
        window = days(filters.start, filters.end)
        facts = _DepartmentFacts(
            cases=workload.cases_by_department(self._session, scope, window),
            resolution=durations.resolution_by(self._session, scope, window, Case.department_id),
            sla=durations.sla_by(self._session, scope, window, Case.department_id),
            open_tasks=workload.open_tasks_by_department(self._session, scope),
            staff=workload.active_staff_by_department(self._session, self._actor.organization_id),
        )
        departments = department_repository.list_active(self._session, self._actor.organization_id)
        items = [
            facts.performance(department)
            for department in departments
            if filters.department_id in (None, department.id)
        ]
        items.sort(key=lambda item: (-item.cases, item.department.code))
        return DepartmentsRead(items=items)

    def recurring(self, filters: AnalyticsFilter) -> RecurringRead:
        """Donem sonuna kadarki son RECURRING_WINDOW_DAYS gun; donem baslangici kullanilmaz."""
        first = filters.end - timedelta(days=RECURRING_WINDOW_DAYS - 1)
        rows = recurring.recurring_problems(
            self._session,
            resolve_scope(self._session, self._actor, filters),
            days(first, filters.end),
            RECURRING_MIN_COUNT,
        )
        return RecurringRead(
            threshold=RECURRING_MIN_COUNT,
            window_days=RECURRING_WINDOW_DAYS,
            items=[_problem(row) for row in rows],
        )

    def process(self, filters: AnalyticsFilter) -> ProcessRead:
        steps = process.step_stats(
            self._session,
            resolve_scope(self._session, self._actor, filters),
            days(filters.start, filters.end),
        )
        slowest = process.bottleneck(steps)
        return ProcessRead(
            steps=[_step(step) for step in steps],
            bottleneck=_step(slowest) if slowest else None,
        )
