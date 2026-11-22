"""Gorevden ayrilan personel ve kapanan birim (E4): pasif yapilan, rolu degisen ya da baska birime
gecen personelin ve pasif yapilan birimin acik gorevleri sahipsiz kalmaz.

Gorev iptal edilir, bildirim mudur kararina (ESCALATED) duser ve mudur bildirim alir; kime
verilecegine mudur karar verir (inceleme kuyrugu). Bitmis isler (RESOLVED, VERIFICATION) etkilenmez.
"""

from sqlalchemy.orm import Session

from app.core.clock import Clock
from app.core.constants import ASSIGNEE_UNAVAILABLE, DEPARTMENT_INACTIVE
from app.models import Task, User
from app.models.enums import ActorType, CaseEventType, CaseStatus, TaskStatus, UserRole
from app.repositories import task_repository
from app.services.workflow import (
    ACTIVE_TASK_STATUSES,
    Transition,
    WorkflowService,
    ensure_task_transition_allowed,
)


def on_duty(user: User) -> tuple[bool, int | None]:
    """Gorev alabilir mi ve hangi birimde; degisikligin oncesi ve sonrasi karsilastirilir."""
    return user.is_active and user.role is UserRole.STAFF, user.department_id


def left_duty(before: tuple[bool, int | None], after: tuple[bool, int | None]) -> bool:
    was_on_duty, _ = before
    return was_on_duty and after != before


class TaskReleaser:
    def __init__(self, session: Session, clock: Clock, actor: User) -> None:
        self._session = session
        self._workflow = WorkflowService(session, clock)
        self._actor = actor

    def release_all(self, staff: User) -> None:
        tasks = task_repository.active_for_user(self._session, staff.id, list(ACTIVE_TASK_STATUSES))
        for task in tasks:
            self._release(task, ASSIGNEE_UNAVAILABLE)

    def release_department(self, department_id: int) -> None:
        """Pasif birimin isleri: birim de bosaltilir, mudur yeni birim ve kisi secer."""
        statuses = list(ACTIVE_TASK_STATUSES)
        for task in task_repository.active_for_department(self._session, department_id, statuses):
            task.case.department_id = None
            self._release(task, DEPARTMENT_INACTIVE)

    def _release(self, task: Task, reason: str) -> None:
        ensure_task_transition_allowed(task.status, TaskStatus.CANCELLED)
        task.status = TaskStatus.CANCELLED
        case = task.case
        case.assigned_staff_id = None
        released = Transition(
            event_type=CaseEventType.ESCALATED,
            actor_type=ActorType.USER,
            actor_id=self._actor.id,
            metadata={
                "reason": reason,
                "task_id": task.id,
                "previous_assignee_id": task.assigned_user_id,
            },
        )
        self._workflow.transition(case, CaseStatus.ESCALATED, released)
