"""Tekrarlayan sorunlar (docs/ANALYTICS.md "Recurring problems", RQ4): ayni yer + ayni tur,
pencere icinde esik ve ustu. Birlestirilen bildirimler ayri tekrar sayilmaz.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.case_kpis import minutes_between, rounded
from app.analytics.scope import NO_DURATION, NOT_COUNTED, Scope, Window
from app.models import Case, CaseType, Location
from app.schemas.analytics import TrendDirection


@dataclass(frozen=True)
class RecurringRow:
    location: Location
    case_type: CaseType
    count: int
    last_reported_at: datetime
    avg_resolution_min: float | None
    trend: TrendDirection


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
            func.avg(minutes).filter(Case.status.not_in(NO_DURATION)),
            func.count(Case.id).filter(Case.created_at < middle),
        )
        .join(Location, Location.id == Case.location_id)
        .join(CaseType, CaseType.id == Case.case_type_id)
        .where(window.contains(Case.created_at), Case.status.not_in(NOT_COUNTED))
        .group_by(Location.id, CaseType.id)
        .having(total >= threshold)
        .order_by(total.desc(), Location.path, CaseType.code)
    )
    return [
        RecurringRow(
            location, case_type, count, last, rounded(avg), _direction(first, count - first)
        )
        for location, case_type, count, last, avg, first in session.execute(statement)
    ]
