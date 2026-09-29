from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import ColumnElement, Select, false, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Case, CaseEvent
from app.models.case import CASE_NUMBER_SEQUENCE
from app.models.enums import CaseStatus
from app.schemas.common import PageParams


@dataclass(frozen=True)
class CaseScope:
    """Kim hangi bildirimleri gorur (docs/WORKFLOW.md bolum 4); hesap: services/case_service.py.

    Tum alanlar bossa kurumun tum bildirimleri; doluysa aralarinda VEYA uygulanir.
    """

    organization_id: int
    reporter_id: int | None = None
    department_id: int | None = None
    assigned_staff_id: int | None = None

    @property
    def is_restricted(self) -> bool:
        return any(
            value is not None
            for value in (self.reporter_id, self.department_id, self.assigned_staff_id)
        )


_WITH_SUMMARIES = (
    selectinload(Case.location),
    selectinload(Case.case_type),
    selectinload(Case.department),
    selectinload(Case.sla_rule),
)


def next_case_number(session: Session) -> int:
    number: int = session.execute(CASE_NUMBER_SEQUENCE.next_value()).scalar_one()
    return number


def add(session: Session, case: Case) -> Case:
    session.add(case)
    session.flush()
    return case


def add_event(session: Session, event: CaseEvent) -> None:
    session.add(event)
    session.flush()


def get(session: Session, case_id: int) -> Case | None:
    # populate_existing: oturumda zaten olan nesnenin iliskileri (department, case_type) de
    # yeniden yuklenir; aksi halde atama sonrasi eski (bos) departman doner (expire_on_commit=False)
    return session.scalars(
        select(Case)
        .where(Case.id == case_id)
        .options(*_WITH_SUMMARIES)
        .execution_options(populate_existing=True)
    ).one_or_none()


def list_page(
    session: Session, scope: CaseScope, statuses: Sequence[CaseStatus], paging: PageParams
) -> tuple[Sequence[Case], int]:
    query = _scoped(scope)
    if statuses:
        query = query.where(Case.status.in_(statuses))
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = session.scalars(
        query.options(*_WITH_SUMMARIES)
        .order_by(Case.created_at.desc(), Case.id.desc())
        .offset(paging.offset)
        .limit(paging.page_size)
    ).all()
    return items, total


def list_events(session: Session, case_id: int) -> Sequence[CaseEvent]:
    return session.scalars(
        select(CaseEvent)
        .where(CaseEvent.case_id == case_id)
        .order_by(CaseEvent.occurred_at, CaseEvent.id)
    ).all()


def _scoped(scope: CaseScope) -> Select[Case]:
    query = select(Case).where(Case.organization_id == scope.organization_id)
    if not scope.is_restricted:
        return query
    conditions: list[ColumnElement[bool]] = [false()]
    if scope.reporter_id is not None:
        conditions.append(Case.reporter_id == scope.reporter_id)
    if scope.department_id is not None:
        conditions.append(Case.department_id == scope.department_id)
    if scope.assigned_staff_id is not None:
        conditions.append(Case.assigned_staff_id == scope.assigned_staff_id)
    return query.where(or_(*conditions))
