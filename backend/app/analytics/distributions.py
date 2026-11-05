"""Trend, kategori, lokasyon ve yaslanma dagilimlari (docs/ANALYTICS.md bolum 2)."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import ColumnElement, Date, Select, cast, func, select
from sqlalchemy.orm import Session

from app.analytics.scope import NOT_COUNTED, TERMINAL, TURKEY_TZ_NAME, Scope, Window
from app.models import Case, CaseType, Location
from app.models.enums import CaseCategory

SECONDS_PER_HOUR = 3600


@dataclass(frozen=True)
class TypeCount:
    category: CaseCategory
    code: str
    name: str
    count: int


def _local_bucket(column: Any, unit: str) -> ColumnElement[date]:
    # Kova sinirlari kampus saatine gore: gece yarisi 00:30'da acilan bildirim o gune yazilir
    return cast(func.date_trunc(unit, func.timezone(TURKEY_TZ_NAME, column)), Date)


def counts_by_bucket(
    session: Session, scope: Scope, window: Window, unit: str
) -> tuple[dict[date, int], dict[date, int]]:
    """(acilan, kapanan) kova -> sayi. unit: day | week | month (date_trunc)."""
    opened_bucket = _local_bucket(Case.created_at, unit)
    opened = scope.apply(
        select(opened_bucket, func.count(Case.id))
        .where(window.contains(Case.created_at), Case.status.not_in(NOT_COUNTED))
        .group_by(opened_bucket)
    )
    closed_bucket = _local_bucket(Case.closed_at, unit)
    closed = scope.apply(
        select(closed_bucket, func.count(Case.id))
        .where(window.contains(Case.closed_at))
        .group_by(closed_bucket)
    )
    return _as_dict(session, opened), _as_dict(session, closed)


def _as_dict(session: Session, statement: Select[date, int]) -> dict[date, int]:
    return {bucket: total for bucket, total in session.execute(statement)}


def type_counts(session: Session, scope: Scope, window: Window) -> list[TypeCount]:
    """Donemde acilan ve turu belli olanlar (analiz bekleyenler dagilima girmez)."""
    statement = scope.apply(
        select(Case.category, CaseType.code, CaseType.name, func.count(Case.id))
        .join(CaseType, CaseType.id == Case.case_type_id)
        .where(
            window.contains(Case.created_at),
            Case.status.not_in(NOT_COUNTED),
            Case.category.is_not(None),
        )
        .group_by(Case.category, CaseType.code, CaseType.name)
    )
    # category IS NOT NULL sorguda; dongu tip daraltmasi icin tekrar bakar
    return [
        TypeCount(category, code, name, total)
        for category, code, name, total in session.execute(statement)
        if category is not None
    ]


def counts_by_location(
    session: Session, scope: Scope, window: Window
) -> dict[int, dict[CaseCategory | None, int]]:
    """lokasyon id -> kategori -> sayi (donemde acilanlar)."""
    statement = scope.apply(
        select(Case.location_id, Case.category, func.count(Case.id))
        .where(window.contains(Case.created_at), Case.status.not_in(NOT_COUNTED))
        .group_by(Case.location_id, Case.category)
    )
    result: dict[int, dict[CaseCategory | None, int]] = defaultdict(dict)
    for location_id, category, total in session.execute(statement):
        result[location_id][category] = total
    return result


def organization_locations(session: Session, organization_id: int) -> list[Location]:
    # Pasif lokasyonlar da gerekir: gecmis bildirimler onlara bagli olabilir
    return list(
        session.scalars(select(Location).where(Location.organization_id == organization_id))
    )


def open_ages_hours(session: Session, scope: Scope, now: datetime) -> list[float]:
    """Su an acik bildirimlerin yasi (saat)."""
    statement = scope.apply(select(Case.created_at).where(Case.status.not_in(TERMINAL)))
    return [
        (now - created).total_seconds() / SECONDS_PER_HOUR for created in session.scalars(statement)
    ]


def bucket_starts(first: date, last: date, unit: str) -> list[date]:
    """Bos kovalar da grafikte gorunsun diye donemin tum kova baslangiclari."""
    start = _truncate(first, unit)
    starts = []
    while start <= last:
        starts.append(start)
        start = _NEXT[unit](start)
    return starts


def _truncate(day: date, unit: str) -> date:
    # date_trunc ile ayni: hafta pazartesi, ay ilk gun
    return {"day": day, "week": day - timedelta(days=day.weekday()), "month": day.replace(day=1)}[
        unit
    ]


def _next_month(day: date) -> date:
    return (day.replace(day=28) + timedelta(days=4)).replace(day=1)


_NEXT = {
    "day": lambda day: day + timedelta(days=1),
    "week": lambda day: day + timedelta(weeks=1),
    "month": _next_month,
}
