"""Cozum suresi ve SLA raporlari (docs/ANALYTICS.md bolum 2).

Ayni hesap kategori, oncelik ya da birim bazinda gerekir; gruplama kolonu parametredir.
"""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.case_kpis import DurationStats, minutes_between, rounded
from app.analytics.scope import NO_DURATION, Scope, Window
from app.models import Case
from app.models.enums import CaseCategory, Priority


@dataclass(frozen=True)
class CategoryDurations:
    category: CaseCategory
    stats: DurationStats


@dataclass(frozen=True)
class SlaCounts:
    with_sla: int
    met: int

    @property
    def breached(self) -> int:
        return self.with_sla - self.met


def resolution_by(
    session: Session, scope: Scope, window: Window, group: Any
) -> dict[Any, DurationStats]:
    """Donemde cozulenlerin suresi, group kolonunun her degeri icin (bos grup donmez)."""
    minutes = minutes_between(Case.resolved_at, Case.created_at)
    statement = scope.apply(
        select(
            group,
            func.count(Case.id),
            func.avg(minutes),
            func.percentile_cont(0.5).within_group(minutes),
            func.percentile_cont(0.9).within_group(minutes),
        )
        .where(
            window.contains(Case.resolved_at), Case.status.not_in(NO_DURATION), group.is_not(None)
        )
        .group_by(group)
    )
    return {
        key: DurationStats(total, rounded(avg), rounded(median), rounded(p90))
        for key, total, avg, median, p90 in session.execute(statement)
    }


def resolution_by_category(
    session: Session, scope: Scope, window: Window
) -> list[CategoryDurations]:
    """Kategori bazinda; en cok bildirim alan once."""
    rows = resolution_by(session, scope, window, Case.category)
    ordered = sorted(rows.items(), key=lambda item: (-item[1].count, item[0]))
    return [CategoryDurations(category, stats) for category, stats in ordered]


def sla_by(session: Session, scope: Scope, window: Window, group: Any) -> dict[Any, SlaCounts]:
    """Donemde kapanan ve SLA'si olanlar: cozum hedef zamanindan once mi?"""
    statement = scope.apply(
        select(
            group,
            func.count(Case.id),
            func.count(Case.id).filter(Case.resolved_at <= Case.due_at),
        )
        .where(window.contains(Case.closed_at), Case.due_at.is_not(None))
        .group_by(group)
    )
    return {key: SlaCounts(total, met) for key, total, met in session.execute(statement)}


def sla_by_priority(session: Session, scope: Scope, window: Window) -> dict[Priority, SlaCounts]:
    """Her oncelik doner (bos olanlar 0) ki grafik eksenleri sabit kalsin."""
    found = sla_by(session, scope, window, Case.priority)
    return {priority: found.get(priority, SlaCounts(0, 0)) for priority in Priority}


def sla_total(rows: dict[Priority, SlaCounts]) -> SlaCounts:
    return SlaCounts(
        with_sla=sum(row.with_sla for row in rows.values()),
        met=sum(row.met for row in rows.values()),
    )
