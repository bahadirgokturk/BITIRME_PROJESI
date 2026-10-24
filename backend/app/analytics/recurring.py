"""Tekrarlayan sorunlar (docs/ANALYTICS.md "Recurring problems", RQ4): ayni yer + ayni tur,
pencere icinde esik ve ustu. Birlestirilen (ayni olayin kopyasi) ve reddedilen (gercek bir kampus
sorunu degil, orn. kapsam disi talep) bildirimler sayilmaz.
"""

import math
import statistics
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from itertools import pairwise

from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Session

from app.analytics.case_kpis import minutes_between, rounded
from app.analytics.scope import NO_DURATION, Scope, Window
from app.core.constants import HOURS_PER_DAY, ROUTINE_MIN_EVERY_DAYS
from app.models import Case, CaseType, Location
from app.schemas.analytics import TrendDirection

SECONDS_PER_HOUR = 3600


@dataclass(frozen=True)
class RoutinePlan:
    """Onleyici bakim: ardisik iki bildirim arasindaki ortanca sure ve rutin kontrol sikligi."""

    median_interval_hours: float | None
    # Sorun donmeden once kontrol: ortanca araligin tam gun kismi (en az gunde bir)
    every_days: int | None


def routine_plan(reported: Sequence[datetime]) -> RoutinePlan:
    """Tek bildirimde aralik yoktur; siralama verilen sirayla ilgili degildir."""
    ordered = sorted(reported)
    gaps = [(b - a).total_seconds() / SECONDS_PER_HOUR for a, b in pairwise(ordered)]
    if not gaps:
        return RoutinePlan(median_interval_hours=None, every_days=None)
    median = statistics.median(gaps)
    every = max(ROUTINE_MIN_EVERY_DAYS, math.floor(median / HOURS_PER_DAY))
    return RoutinePlan(median_interval_hours=rounded(median), every_days=every)


@dataclass(frozen=True)
class RecurringRow:
    location: Location
    case_type: CaseType
    count: int
    last_reported_at: datetime
    avg_resolution_min: float | None
    trend: TrendDirection
    routine: RoutinePlan


def _direction(first_half: int, second_half: int) -> TrendDirection:
    if second_half == first_half:
        return TrendDirection.FLAT
    return TrendDirection.UP if second_half > first_half else TrendDirection.DOWN


def recurring_problems(
    session: Session, scope: Scope, window: Window, threshold: int
) -> list[RecurringRow]:
    """En cok tekrarlayan once; trend pencerenin ikinci yarisini ilk yarisiyla karsilastirir."""
    middle = window.start + (window.end - window.start) / 2
    minutes = minutes_between(Case.resolved_at, Case.created_at)
    total = func.count(Case.id)
    statement = scope.apply(
        select(
            Location,
            CaseType,
            total,
            func.max(Case.created_at),
            func.avg(minutes),
            func.count(Case.id).filter(Case.created_at < middle),
        )
        .join(Location, Location.id == Case.location_id)
        .join(CaseType, CaseType.id == Case.case_type_id)
        .where(window.contains(Case.created_at), Case.status.not_in(NO_DURATION))
        .group_by(Location.id, CaseType.id)
        .having(total >= threshold)
        .order_by(total.desc(), Location.path, CaseType.code)
    )
    groups = session.execute(statement).all()
    reported = _report_times(session, scope, window, [(loc.id, ct.id) for loc, ct, *_ in groups])
    return [
        RecurringRow(
            location,
            case_type,
            count,
            last,
            rounded(avg),
            _direction(first, count - first),
            routine_plan(reported[(location.id, case_type.id)]),
        )
        for location, case_type, count, last, avg, first in groups
    ]


def _report_times(
    session: Session, scope: Scope, window: Window, pairs: list[tuple[int, int]]
) -> dict[tuple[int, int], list[datetime]]:
    """Esigi gecen (yer, tur) ciftlerinin bildirim zamanlari; sayimla ayni suzgec."""
    found: dict[tuple[int, int], list[datetime]] = defaultdict(list)
    if not pairs:
        return found
    statement = scope.apply(
        select(Case.location_id, Case.case_type_id, Case.created_at).where(
            window.contains(Case.created_at),
            Case.status.not_in(NO_DURATION),
            tuple_(Case.location_id, Case.case_type_id).in_(pairs),
        )
    )
    for location_id, case_type_id, created in session.execute(statement):
        # Esigi gecen ciftlerin turu her zaman doludur (gruplama case_types ile join'li)
        if case_type_id is not None:
            found[(location_id, case_type_id)].append(created)
    return found
