"""Cozum suresi ve SLA raporlari (docs/ANALYTICS.md bolum 2)."""

from dataclasses import dataclass

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


def resolution_by_category(
    session: Session, scope: Scope, window: Window
) -> list[CategoryDurations]:
    """Donemde cozulenler, kategori bazinda; en cok bildirim alan once."""
    minutes = minutes_between(Case.resolved_at, Case.created_at)
    statement = scope.apply(
        select(
            Case.category,
            func.count(Case.id),
            func.avg(minutes),
            func.percentile_cont(0.5).within_group(minutes),
            func.percentile_cont(0.9).within_group(minutes),
        )
        .where(
            window.contains(Case.resolved_at),
            Case.status.not_in(NO_DURATION),
            Case.category.is_not(None),
        )
        .group_by(Case.category)
    )
    rows = sorted(session.execute(statement).all(), key=lambda row: (-row[1], row[0]))
    return [
        CategoryDurations(category, DurationStats(total, rounded(avg), rounded(med), rounded(p90)))
        for category, total, avg, med, p90 in rows
    ]


def sla_by_priority(session: Session, scope: Scope, window: Window) -> dict[Priority, SlaCounts]:
    """Donemde kapanan ve SLA'si olanlar: cozum hedef zamanindan once mi? Her oncelik doner
    (bos olanlar 0) ki grafik eksenleri sabit kalsin."""
    statement = scope.apply(
        select(
            Case.priority,
            func.count(Case.id),
            func.count(Case.id).filter(Case.resolved_at <= Case.due_at),
        )
        .where(window.contains(Case.closed_at), Case.due_at.is_not(None))
        .group_by(Case.priority)
    )
    found = {priority: SlaCounts(total, met) for priority, total, met in session.execute(statement)}
    return {priority: found.get(priority, SlaCounts(0, 0)) for priority in Priority}


def sla_total(rows: dict[Priority, SlaCounts]) -> SlaCounts:
    return SlaCounts(
        with_sla=sum(row.with_sla for row in rows.values()),
        met=sum(row.met for row in rows.values()),
    )
