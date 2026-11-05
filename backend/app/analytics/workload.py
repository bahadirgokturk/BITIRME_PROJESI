"""Birim is yuku (docs/ANALYTICS.md "Departman performansi"): anlik acik gorev ve aktif personel."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.analytics.scope import NOT_COUNTED, Scope, Window
from app.models import Case, Task, User
from app.models.enums import UserRole
from app.services.workflow import ACTIVE_TASK_STATUSES


def cases_by_department(session: Session, scope: Scope, window: Window) -> dict[int, int]:
    """Donemde acilip birime yonlenen bildirimler (birlestirilenler haric)."""
    statement = scope.apply(
        select(Case.department_id, func.count(Case.id))
        .where(
            window.contains(Case.created_at),
            Case.status.not_in(NOT_COUNTED),
            Case.department_id.is_not(None),
        )
        .group_by(Case.department_id)
    )
    return {
        department_id: total
        for department_id, total in session.execute(statement)
        if department_id is not None
    }


def open_tasks_by_department(session: Session, scope: Scope) -> dict[int, int]:
    """Su an bekleyen, kabul edilmis ya da suren gorevler; bina filtresi bildirimin yerinden."""
    statement = scope.apply(
        select(Task.department_id, func.count(Task.id))
        .join(Case, Case.id == Task.case_id)
        .where(Task.status.in_(ACTIVE_TASK_STATUSES))
        .group_by(Task.department_id)
    )
    return {department_id: total for department_id, total in session.execute(statement)}


def active_staff_by_department(session: Session, organization_id: int) -> dict[int, int]:
    statement = (
        select(User.department_id, func.count(User.id))
        .where(
            User.organization_id == organization_id,
            User.role == UserRole.STAFF,
            User.is_active.is_(True),
            User.department_id.is_not(None),
        )
        .group_by(User.department_id)
    )
    return {
        department_id: total
        for department_id, total in session.execute(statement)
        if department_id is not None
    }
