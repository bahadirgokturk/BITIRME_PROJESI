from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import ColumnElement, Select, and_, false, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Case, CaseEvent, Location
from app.models.case import CASE_NUMBER_SEQUENCE
from app.models.enums import SLA_SETTLED_STATUSES, CaseCategory, CaseStatus, Priority
from app.repositories.text_search import fold, folded
from app.schemas.common import ListOrder, PageParams


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


@dataclass(frozen=True)
class CaseFilter:
    """Liste suzgecleri (docs/API.md "Cases"); bos alan suzmez, dolu alanlar VE ile birlesir."""

    # SLA asimi okuma aninda hesaplanir (services/sla.py); sorgu ayni ani kullanir
    now: datetime
    statuses: Sequence[CaseStatus] = ()
    priorities: Sequence[Priority] = ()
    breached_only: bool = False
    text: str | None = None
    order: ListOrder = ListOrder.NEWEST
    department_id: int | None = None
    categories: Sequence[CaseCategory] = ()
    # Lokasyon yolu (Location.path); kendisi ve alt agaci
    location_path: str | None = None
    # created_at >= created_from ve created_at < created_before
    created_from: datetime | None = None
    created_before: datetime | None = None


# Yanittaki ozetler (CaseRead) tek sorguda; inceleme kuyrugu da kullanir
WITH_SUMMARIES = (
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


def find_by_idempotency_key(session: Session, reporter_id: int, key: str) -> Case | None:
    return session.scalars(
        select(Case).where(Case.reporter_id == reporter_id, Case.idempotency_key == key)
    ).one_or_none()


def add_event(session: Session, event: CaseEvent) -> None:
    session.add(event)
    session.flush()


def get(session: Session, case_id: int) -> Case | None:
    # populate_existing: oturumda zaten olan nesnenin iliskileri (department, case_type) de
    # yeniden yuklenir; aksi halde atama sonrasi eski (bos) departman doner (expire_on_commit=False)
    return session.scalars(
        select(Case)
        .where(Case.id == case_id)
        .options(*WITH_SUMMARIES)
        .execution_options(populate_existing=True)
    ).one_or_none()


def list_page(
    session: Session, scope: CaseScope, filters: CaseFilter, paging: PageParams
) -> tuple[Sequence[Case], int]:
    query = _scoped(scope).where(*_conditions(filters))
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = session.scalars(
        query.options(*WITH_SUMMARIES)
        .order_by(*_ordering(filters.order))
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


def _conditions(filters: CaseFilter) -> list[ColumnElement[bool]]:
    # (suzgec dolu mu, kosulu kuran fonksiyon); bos suzgec kosul eklemez
    builders: tuple[tuple[object, Callable[[], ColumnElement[bool]]], ...] = (
        (filters.statuses, lambda: Case.status.in_(filters.statuses)),
        (filters.priorities, lambda: Case.priority.in_(filters.priorities)),
        (filters.breached_only, lambda: _breached(filters.now)),
        (filters.text, lambda: _matches(filters.text or "")),
        (filters.department_id is not None, lambda: Case.department_id == filters.department_id),
        (filters.categories, lambda: Case.category.in_(filters.categories)),
        (filters.location_path, lambda: _within(filters.location_path or "")),
        (filters.created_from, lambda: Case.created_at >= filters.created_from),
        (filters.created_before, lambda: Case.created_at < filters.created_before),
    )
    return [build() for active, build in builders if active]


def _within(path: str) -> ColumnElement[bool]:
    """Lokasyonun kendisi ve alt agaci; "B" secilince "BX" binasi gelmez."""
    subtree = select(Location.id).where(
        or_(Location.path == path, Location.path.startswith(f"{path}/", autoescape=True))
    )
    return Case.location_id.in_(subtree)


def _breached(now: datetime) -> ColumnElement[bool]:
    """services/sla.py sla_status() == BREACHED'in SQL karsiligi."""
    settled = and_(Case.status.in_(SLA_SETTLED_STATUSES), Case.resolved_at.is_not(None))
    return and_(
        Case.due_at.is_not(None),
        or_(
            and_(settled, Case.resolved_at > Case.due_at),
            and_(~settled, Case.due_at < now),
        ),
    )


def _matches(text: str) -> ColumnElement[bool]:
    """Numara, baslik ya da konum adinda gecen parca; % ve _ duz metin sayilir."""
    needle = fold(text)
    locations = select(Location.id).where(folded(Location.name).contains(needle, autoescape=True))
    return or_(
        folded(Case.case_number).contains(needle, autoescape=True),
        folded(Case.title).contains(needle, autoescape=True),
        Case.location_id.in_(locations),
    )


def _ordering(order: ListOrder) -> tuple[ColumnElement[Any], ...]:
    """Acilis zamanina gore; ayni anda acilanlar id ile ayni sirada kalir."""
    if order is ListOrder.OLDEST:
        return Case.created_at.asc(), Case.id.asc()
    return Case.created_at.desc(), Case.id.desc()
