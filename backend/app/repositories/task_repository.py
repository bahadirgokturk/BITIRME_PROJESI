from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Case, Task
from app.models.enums import TaskStatus
from app.schemas.common import PageParams

_WITH_SUMMARIES = (
    selectinload(Task.case).selectinload(Case.location),
    selectinload(Task.case).selectinload(Case.sla_rule),
    selectinload(Task.department),
)


@dataclass(frozen=True)
class StaffQueue:
    """Personelin gorevleri: kendisine atananlar + departmaninin sahipsiz kuyrugu."""

    organization_id: int
    user_id: int
    department_id: int | None
    statuses: Sequence[TaskStatus]


def add(session: Session, task: Task) -> Task:
    session.add(task)
    session.flush()
    return task


def get(session: Session, task_id: int) -> Task | None:
    # populate_existing: iliskiler bayat kalmasin (case_repository.get ile ayni neden)
    return session.scalars(
        select(Task)
        .where(Task.id == task_id)
        .options(*_WITH_SUMMARIES)
        .execution_options(populate_existing=True)
    ).one_or_none()


def active_for_case(session: Session, case_id: int, statuses: Sequence[TaskStatus]) -> Task | None:
    return session.scalars(
        select(Task).where(Task.case_id == case_id, Task.status.in_(statuses))
    ).one_or_none()


def list_queue(
    session: Session, queue: StaffQueue, paging: PageParams
) -> tuple[Sequence[Task], int]:
    mine = Task.assigned_user_id == queue.user_id
    department_pool = and_(
        Task.assigned_user_id.is_(None), Task.department_id == queue.department_id
    )
    query = (
        select(Task)
        .join(Case, Case.id == Task.case_id)
        .where(
            Case.organization_id == queue.organization_id,
            Task.status.in_(queue.statuses),
            or_(mine, department_pool) if queue.department_id is not None else mine,
        )
    )
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = session.scalars(
        query.options(*_WITH_SUMMARIES)
        # En acil once: SLA hedefi olanlar yakin tarihe gore, olmayanlar sonda
        .order_by(Case.due_at.asc().nulls_last(), Task.created_at, Task.id)
        .offset(paging.offset)
        .limit(paging.page_size)
    ).all()
    return items, total
