"""Monitoring Agent'in (E5-10) izledigi bildirimler ve uyari gecmisi."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Case, CaseEvent
from app.models.enums import CaseEventType, CaseStatus


def open_cases(session: Session, statuses: frozenset[CaseStatus]) -> Sequence[Case]:
    return session.scalars(
        select(Case)
        .where(Case.status.in_(statuses))
        .options(
            selectinload(Case.location), selectinload(Case.case_type), selectinload(Case.sla_rule)
        )
        .order_by(Case.id)
    ).all()


def entered_status_at(session: Session, case: Case) -> datetime:
    """Bildirimin su anki durumuna son giris zamani (olay kaydindan); kayit yoksa olusturulma."""
    entered = session.scalar(
        select(func.max(CaseEvent.occurred_at)).where(
            CaseEvent.case_id == case.id, CaseEvent.to_status == case.status
        )
    )
    return entered or case.created_at


def has_event(
    session: Session, case_id: int, event_type: CaseEventType, since: datetime | None = None
) -> bool:
    statement = select(func.count()).where(
        CaseEvent.case_id == case_id, CaseEvent.event_type == event_type
    )
    if since is not None:
        statement = statement.where(CaseEvent.occurred_at >= since)
    return (session.scalar(statement) or 0) > 0
