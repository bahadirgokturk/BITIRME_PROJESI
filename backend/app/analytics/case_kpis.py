"""KPI kartlarinin sorgulari (docs/ANALYTICS.md bolum 1). Her fonksiyon tek bir donemi hesaplar;
onceki donemle karsilastirmayi AnalyticsService yapar.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import ColumnElement, and_, exists, func, or_, select
from sqlalchemy.orm import Session

from app.agents.supervisor import SupervisorAgent, SupervisorDecision
from app.analytics.decisions import latest_decisions
from app.analytics.scope import NO_DURATION, NOT_COUNTED, Scope, Window
from app.core.constants import PERCENT
from app.models import Case, CaseEvent
from app.models.enums import ActorType, CaseEventType

SECONDS_PER_MINUTE = 60
# Oran ve surelerin gosterim hassasiyeti: kartta tek ondalik yeterli (%33,3 / 17,5 dk)
DECIMALS = 1
# Insan dokunmadan atanmis sayilan Supervisor kararlari (docs/ANALYTICS.md "Automation Rate")
AUTOMATED = frozenset({SupervisorDecision.AUTO_ASSIGN, SupervisorDecision.CREATE_TASK})
HUMAN_REVIEW = frozenset({SupervisorDecision.ESCALATE, SupervisorDecision.SEND_TO_HUMAN_REVIEW})
# Kullanicinin elle yaptigi atama: AI'in karari yerine insanin karari gecti
MANUAL_ASSIGNMENT = (CaseEventType.TASK_CREATED, CaseEventType.TASK_REASSIGNED)


@dataclass(frozen=True)
class DurationStats:
    count: int
    avg: float | None
    median: float | None
    p90: float | None


@dataclass(frozen=True)
class AgentShare:
    analyzed: int
    automated: int
    human_review: int


def percent(part: int, whole: int) -> float | None:
    if whole == 0:
        return None
    return round(part * PERCENT / whole, DECIMALS)


def rounded(value: Any) -> float | None:
    return None if value is None else round(float(value), DECIMALS)


def minutes_between(end: Any, start: Any) -> ColumnElement[Any]:
    return func.extract("epoch", end - start) / SECONDS_PER_MINUTE


def _count(session: Session, scope: Scope, *conditions: ColumnElement[bool]) -> int:
    return session.scalar(scope.apply(select(func.count(Case.id)).where(*conditions))) or 0


def created_count(session: Session, scope: Scope, window: Window) -> int:
    return _count(session, scope, window.contains(Case.created_at), Case.status.not_in(NOT_COUNTED))


def open_count_at(session: Session, scope: Scope, moment: datetime) -> int:
    """O anda acik olanlar: daha once acilmis, henuz kapanmamis. Reddedilen ve birlestirilen hic
    acik sayilmaz (kapanis zamanlari olmadigi icin gecmise donuk hesaplanamaz)."""
    return _count(
        session,
        scope,
        Case.created_at < moment,
        or_(Case.closed_at.is_(None), Case.closed_at >= moment),
        Case.status.not_in(NO_DURATION),
    )


def closed_count(session: Session, scope: Scope, window: Window) -> int:
    return _count(session, scope, window.contains(Case.closed_at))


def duration_stats(session: Session, scope: Scope, window: Window, column: Any) -> DurationStats:
    """Olusturmadan column'a kadar gecen sure (dk); column donem icinde olanlar."""
    minutes = minutes_between(column, Case.created_at)
    statement = scope.apply(
        select(
            func.count(Case.id),
            func.avg(minutes),
            func.percentile_cont(0.5).within_group(minutes),
            func.percentile_cont(0.9).within_group(minutes),
        ).where(window.contains(column), Case.status.not_in(NO_DURATION))
    )
    total, avg, median, p90 = session.execute(statement).one()
    return DurationStats(total, rounded(avg), rounded(median), rounded(p90))


def sla_breach(session: Session, scope: Scope, window: Window) -> tuple[int, int]:
    """(SLA_BREACHED olayi olan, SLA'li) -- donemde acilan bildirimler."""
    breached = exists().where(
        CaseEvent.case_id == Case.id, CaseEvent.event_type == CaseEventType.SLA_BREACHED
    )
    statement = scope.apply(
        select(func.count(Case.id).filter(breached), func.count(Case.id)).where(
            window.contains(Case.created_at),
            Case.due_at.is_not(None),
            Case.status.not_in(NOT_COUNTED),
        )
    )
    hit, total = session.execute(statement).one()
    return hit, total


def reopened(session: Session, scope: Scope, window: Window) -> tuple[int, int]:
    """(yeniden acilmis, kapanan) -- donemde kapananlar."""
    statement = scope.apply(
        select(func.count(Case.id).filter(Case.reopened_count > 0), func.count(Case.id)).where(
            window.contains(Case.closed_at)
        )
    )
    hit, total = session.execute(statement).one()
    return hit, total


def agent_share(session: Session, scope: Scope, window: Window) -> AgentShare:
    """Donemde acilip Supervisor'dan gecen bildirimler; her bildirimin son karari sayilir.

    Otomatik: karar atama/gorev ve sonrasinda insan AI kararini duzeltmedi ya da elle atamadi.
    """
    latest = latest_decisions(SupervisorAgent.name)
    touched = exists().where(
        CaseEvent.case_id == Case.id,
        or_(
            CaseEvent.event_type == CaseEventType.DECISION_OVERRIDDEN,
            and_(
                CaseEvent.event_type.in_(MANUAL_ASSIGNMENT), CaseEvent.actor_type == ActorType.USER
            ),
        ),
    )
    statement = scope.apply(
        select(latest.c.decision, touched)
        .select_from(Case)
        .join(latest, latest.c.case_id == Case.id)
        .where(window.contains(Case.created_at), Case.status.not_in(NOT_COUNTED))
    )
    rows = session.execute(statement).all()
    return AgentShare(
        analyzed=len(rows),
        automated=sum(1 for decision, by_human in rows if decision in AUTOMATED and not by_human),
        human_review=sum(1 for decision, _ in rows if decision in HUMAN_REVIEW),
    )
