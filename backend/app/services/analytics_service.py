"""Bildirim KPI'lari ve dagilimlari (E6-2, E6-3): app/analytics sonuclarini API semasina cevirir.

Kapsam her zaman kullanicinin kurumudur; bina filtresi baska kurumun lokasyonuysa 404 (IDOR).
"""

from collections import Counter
from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session

from app.agents.analytics_summary import CATEGORY_LABELS
from app.analytics import case_kpis, distributions, durations
from app.analytics.case_kpis import percent
from app.analytics.location_levels import LocationTree
from app.analytics.scope import TURKEY, AnalyticsFilter, Scope, Window, days
from app.core.clock import Clock
from app.core.constants import PERCENT
from app.core.errors import NotFoundError
from app.models import Case, Location, User
from app.models.enums import CaseCategory
from app.repositories import location_repository
from app.schemas.analytics import (
    AgingBucket,
    AgingRead,
    CaseTypeCount,
    CategoriesRead,
    CategoryShare,
    Granularity,
    KpisRead,
    KpiValue,
    LocationLevel,
    LocationLoad,
    LocationsRead,
    PeriodRead,
    ResolutionTimeRow,
    ResolutionTimesRead,
    SlaPriorityRow,
    SlaRead,
    TrendPoint,
    TrendRead,
)
from app.schemas.case import LocationSummary

# Acik bildirim yas kovalari, saat (docs/ANALYTICS.md "Aging"); son kova ust sinirsiz
AGING_BUCKETS: tuple[tuple[int, int | None], ...] = ((0, 2), (2, 6), (6, 12), (12, 24), (24, None))
# Bir metrigi (scope, donem) icin hesaplayan fonksiyonu alir, (bu donem, onceki donem) doner
Compare = Callable[[Callable[[Scope, Window], Any]], tuple[Any, Any]]


def _kpi(current: float | None, previous: float | None) -> KpiValue:
    if current is None or previous is None or previous == 0:
        return KpiValue(value=current, previous=previous, delta_pct=None)
    delta = round((current - previous) * PERCENT / previous, case_kpis.DECIMALS)
    return KpiValue(value=current, previous=previous, delta_pct=delta)


def _aging_label(low: int, high: int | None) -> str:
    return f"{low}+ sa" if high is None else f"{low}-{high} sa"


def resolve_scope(session: Session, actor: User, filters: AnalyticsFilter) -> Scope:
    """Kullanicinin kurumu + filtreler. Bina baska kurumunsa 404 (IDOR)."""
    building_path = None
    if filters.building_id is not None:
        building = location_repository.get(session, filters.building_id)
        if building is None or building.organization_id != actor.organization_id:
            raise NotFoundError()
        building_path = building.path
    return Scope(actor.organization_id, filters.department_id, building_path)


class AnalyticsService:
    def __init__(self, session: Session, actor: User, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock

    # --- KPI kartlari -----------------------------------------------------------------------

    def kpis(self, filters: AnalyticsFilter) -> KpisRead:
        scope = self._scope(filters)
        window = days(filters.start, filters.end)
        today = self._clock.now().astimezone(TURKEY).date()
        compare = self._comparer(scope, window)
        stats = compare(
            lambda s, w: case_kpis.duration_stats(self._session, s, w, Case.resolved_at)
        )
        share = compare(lambda s, w: case_kpis.agent_share(self._session, s, w))
        return KpisRead(
            period=self._period(filters),
            total_cases=self._both(compare(self._created)),
            open_cases=self._both(compare(self._open)),
            closed_cases=self._both(compare(self._closed)),
            cases_today=self._both(self._comparer(scope, days(today, today))(self._created)),
            avg_resolution_min=_kpi(stats[0].avg, stats[1].avg),
            median_resolution_min=_kpi(stats[0].median, stats[1].median),
            median_first_response_min=self._median(compare, Case.accepted_at),
            median_assignment_min=self._median(compare, Case.assigned_at),
            sla_compliance_pct=self._both(compare(self._sla_compliance)),
            sla_breach_pct=self._both(compare(self._ratio(case_kpis.sla_breach))),
            reopen_pct=self._both(compare(self._ratio(case_kpis.reopened))),
            automation_pct=_kpi(*(percent(s.automated, s.analyzed) for s in share)),
            human_review_pct=_kpi(*(percent(s.human_review, s.analyzed) for s in share)),
        )

    @staticmethod
    def _comparer(scope: Scope, window: Window) -> Compare:
        """Ayni hesabi bu donem ve hemen onceki esit donem icin calistirir."""
        return lambda metric: (metric(scope, window), metric(scope, window.previous()))

    @staticmethod
    def _both(values: tuple[float | None, float | None]) -> KpiValue:
        return _kpi(*values)

    def _median(self, compare: Compare, column: Any) -> KpiValue:
        current, previous = compare(
            lambda s, w: case_kpis.duration_stats(self._session, s, w, column)
        )
        return _kpi(current.median, previous.median)

    def _created(self, scope: Scope, window: Window) -> float:
        return case_kpis.created_count(self._session, scope, window)

    def _closed(self, scope: Scope, window: Window) -> float:
        return case_kpis.closed_count(self._session, scope, window)

    def _open(self, scope: Scope, window: Window) -> float:
        # Donem sonundaki (bugunse su anki) acik sayisi; onceki donem icin o donemin sonu
        moment = min(window.end, self._clock.now())
        return case_kpis.open_count_at(self._session, scope, moment)

    def _sla_compliance(self, scope: Scope, window: Window) -> float | None:
        total = durations.sla_total(durations.sla_by_priority(self._session, scope, window))
        return percent(total.met, total.with_sla)

    def _ratio(
        self, query: Callable[[Session, Scope, Window], tuple[int, int]]
    ) -> Callable[[Scope, Window], float | None]:
        return lambda scope, window: percent(*query(self._session, scope, window))

    # --- Dagilimlar -------------------------------------------------------------------------

    def trend(self, filters: AnalyticsFilter, granularity: Granularity) -> TrendRead:
        opened, closed = distributions.counts_by_bucket(
            self._session, self._scope(filters), days(filters.start, filters.end), granularity.value
        )
        starts = distributions.bucket_starts(filters.start, filters.end, granularity.value)
        points = [
            TrendPoint(bucket=start, opened=opened.get(start, 0), closed=closed.get(start, 0))
            for start in starts
        ]
        return TrendRead(granularity=granularity, points=points)

    def categories(self, filters: AnalyticsFilter) -> CategoriesRead:
        rows = distributions.type_counts(
            self._session, self._scope(filters), days(filters.start, filters.end)
        )
        totals: Counter[CaseCategory] = Counter()
        for row in rows:
            totals[row.category] += row.count
        items = [
            CategoryShare(
                category=category,
                label=CATEGORY_LABELS[category],
                count=total,
                case_types=[
                    CaseTypeCount(code=row.code, name=row.name, count=row.count)
                    for row in sorted(rows, key=lambda row: (-row.count, row.code))
                    if row.category is category
                ],
            )
            for category, total in sorted(totals.items(), key=lambda item: (-item[1], item[0]))
        ]
        return CategoriesRead(total=sum(totals.values()), items=items)

    def locations(self, filters: AnalyticsFilter, level: LocationLevel) -> LocationsRead:
        counts = distributions.counts_by_location(
            self._session, self._scope(filters), days(filters.start, filters.end)
        )
        locations = distributions.organization_locations(self._session, self._actor.organization_id)
        tree = LocationTree(locations)
        groups: dict[int, tuple[Location, Counter[CaseCategory | None]]] = {}
        for location in (loc for loc in locations if loc.id in counts):
            group = tree.group_of(location, level)
            groups.setdefault(group.id, (group, Counter()))[1].update(counts[location.id])
        items = [self._load(group, by_category) for group, by_category in groups.values()]
        items.sort(key=lambda item: (-item.count, item.location.path))
        return LocationsRead(level=level, items=items)

    @staticmethod
    def _load(group: Location, by_category: Counter[CaseCategory | None]) -> LocationLoad:
        return LocationLoad(
            location=LocationSummary.model_validate(group, from_attributes=True),
            count=sum(by_category.values()),
            by_category={key: value for key, value in by_category.items() if key is not None},
        )

    def resolution_times(self, filters: AnalyticsFilter) -> ResolutionTimesRead:
        rows = durations.resolution_by_category(
            self._session, self._scope(filters), days(filters.start, filters.end)
        )
        return ResolutionTimesRead(
            items=[
                ResolutionTimeRow(
                    category=row.category,
                    label=CATEGORY_LABELS[row.category],
                    count=row.stats.count,
                    avg_min=row.stats.avg,
                    median_min=row.stats.median,
                    p90_min=row.stats.p90,
                )
                for row in rows
            ]
        )

    def sla(self, filters: AnalyticsFilter) -> SlaRead:
        rows = durations.sla_by_priority(
            self._session, self._scope(filters), days(filters.start, filters.end)
        )
        total = durations.sla_total(rows)
        return SlaRead(
            with_sla=total.with_sla,
            met=total.met,
            breached=total.breached,
            compliance_pct=percent(total.met, total.with_sla),
            by_priority=[
                SlaPriorityRow(
                    priority=priority,
                    with_sla=row.with_sla,
                    met=row.met,
                    breached=row.breached,
                    compliance_pct=percent(row.met, row.with_sla),
                )
                for priority, row in rows.items()
            ],
        )

    def aging(self, filters: AnalyticsFilter) -> AgingRead:
        """Anlik durum: donemden bagimsiz, birim ve bina filtresi gecerli."""
        ages = distributions.open_ages_hours(self._session, self._scope(filters), self._clock.now())
        buckets = [
            AgingBucket(
                label=_aging_label(low, high),
                min_hours=low,
                max_hours=high,
                count=sum(1 for age in ages if age >= low and (high is None or age < high)),
            )
            for low, high in AGING_BUCKETS
        ]
        return AgingRead(total_open=len(ages), buckets=buckets)

    # --- Ortak ------------------------------------------------------------------------------

    def _scope(self, filters: AnalyticsFilter) -> Scope:
        return resolve_scope(self._session, self._actor, filters)

    @staticmethod
    def _period(filters: AnalyticsFilter) -> PeriodRead:
        return PeriodRead(start=filters.start, end=filters.end)
