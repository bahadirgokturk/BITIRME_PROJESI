"""Gorevler (E4-1): manager atamasi ve personel akisi; bildirimle senkron (WORKFLOW.md bolum 1).

| Gorev olayi | Gorev          | Bildirim                                    |
|-------------|----------------|---------------------------------------------|
| atama       | PENDING        | ASSIGNED (ANALYZING ise once CLASSIFIED)    |
| kabul       | ACCEPTED       | ACCEPTED                                    |
| baslat      | IN_PROGRESS    | IN_PROGRESS                                 |
| tamamla     | COMPLETED      | RESOLVED -> VERIFICATION -> CLOSED (gecici) |
| reddet      | DECLINED       | ESCALATED (manager karar kuyrugu)           |
| yeniden ata | onceki CANCELLED | ASSIGNED                                  |

Gecici kural: Resolution Agent (FAZ 5) gelene kadar tamamlanan gorev dogrulama beklemeden kapanir;
olay kaydinda metadata.rule = AUTO_CLOSE_RULE yazar. FAZ 5'te bu adim agent'a devredilir.
"""

from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.clock import Clock
from app.core.errors import ForbiddenError, InvalidAssigneeError, NotFoundError
from app.models import Case, Task, User
from app.models.enums import ActorType, CaseEventType, CaseStatus, TaskStatus, UserRole
from app.repositories import (
    case_repository,
    department_repository,
    sla_repository,
    task_repository,
    user_repository,
)
from app.repositories.task_repository import StaffQueue
from app.schemas.case import CaseRead
from app.schemas.common import Page, PageParams
from app.schemas.task import AssignRequest, CompleteRequest, DeclineRequest, TaskRead
from app.services.authorization import (
    ensure_can_view_case,
    ensure_can_view_task,
    ensure_same_organization,
)
from app.services.case_view import case_read
from app.services.sla import apply_targets, case_sla_status, index_rules
from app.services.workflow import (
    ACTIVE_TASK_STATUSES,
    Transition,
    WorkflowService,
    ensure_task_transition_allowed,
)

AUTO_CLOSE_RULE = "auto_close_until_resolution_agent"


@dataclass(frozen=True)
class Assignment:
    department_id: int
    # None: birimin havuzuna (ilk kabul eden alir)
    user_id: int | None


class TaskOpener:
    """Gorev olusturur ve bildirimi ASSIGNED yapar; manager atamasi ve agent hatti ortak kullanir.

    SLA hedefleri ilk atamada yazilir (app/services/sla.py). Olayi kimin yaptigi `actor` sablonundan
    gelir (manager ya da Routing Agent).
    """

    def __init__(self, session: Session, workflow: WorkflowService, clock: Clock) -> None:
        self._session = session
        self._workflow = workflow
        self._clock = clock

    def open(self, case: Case, assignment: Assignment, actor: Transition) -> Task:
        task = task_repository.add(
            self._session,
            Task(
                case_id=case.id,
                department_id=assignment.department_id,
                assigned_user_id=assignment.user_id,
                title=case.title,
                status=TaskStatus.PENDING,
                created_at=self._clock.now(),
            ),
        )
        rules = sla_repository.active_rules(self._session, case.organization_id)
        apply_targets(case, index_rules(rules))
        case.department_id = assignment.department_id
        case.assigned_staff_id = assignment.user_id
        metadata = {**actor.metadata, "task_id": task.id}
        created = replace(actor, event_type=CaseEventType.TASK_CREATED, metadata=metadata)
        self._workflow.transition(case, CaseStatus.ASSIGNED, created)
        return task


class TaskService:
    def __init__(self, session: Session, actor: User, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock
        self._workflow = WorkflowService(session, clock)

    # --- Manager atamasi ---------------------------------------------------------------

    def assign(self, case_id: int, data: AssignRequest) -> CaseRead:
        case = self._visible_case(case_id)
        if self._actor.role is not UserRole.MANAGER:
            raise ForbiddenError()
        self._ensure_department(data.department_id)
        if data.user_id is not None:
            self._ensure_assignee(data.user_id, data.department_id)
        if case.status is CaseStatus.ANALYZING:
            # Agent'lar (FAZ 5) gelmeden manager atamasi elle siniflandirmadir
            routed = self._by_user(CaseEventType.ROUTED, {"manual": True})
            self._move(case, CaseStatus.CLASSIFIED, routed)
        self._cancel_active_task(case)
        opener = TaskOpener(self._session, self._workflow, self._clock)
        assignment = Assignment(department_id=data.department_id, user_id=data.user_id)
        opener.open(case, assignment, self._by_user(CaseEventType.TASK_CREATED, {}))
        self._session.commit()
        refreshed = case_repository.get(self._session, case.id)
        if refreshed is None:
            raise NotFoundError()
        return case_read(refreshed, self._clock.now())

    # --- Personel ----------------------------------------------------------------------

    def mine(self, statuses: Sequence[TaskStatus], paging: PageParams) -> Page[TaskRead]:
        queue = StaffQueue(
            organization_id=self._actor.organization_id,
            user_id=self._actor.id,
            department_id=self._actor.department_id,
            # Filtre verilmezse yalniz yapilacak isler (aktif gorevler)
            statuses=list(statuses) or list(ACTIVE_TASK_STATUSES),
        )
        items, total = task_repository.list_queue(self._session, queue, paging)
        return Page(
            items=[to_read(task, self._clock.now()) for task in items],
            total=total,
            page=paging.page,
        )

    def get(self, task_id: int) -> TaskRead:
        return to_read(self._visible_task(task_id), self._clock.now())

    def accept(self, task_id: int) -> TaskRead:
        task = self._own_task(task_id)
        self._set_status(task, TaskStatus.ACCEPTED)
        # Departman kuyrugundaki gorev ilk kabul edene gecer
        task.assigned_user_id = self._actor.id
        task.accepted_at = self._clock.now()
        task.case.assigned_staff_id = self._actor.id
        accepted = self._by_user(CaseEventType.TASK_ACCEPTED, {"task_id": task.id})
        self._move(task.case, CaseStatus.ACCEPTED, accepted)
        return self._commit(task)

    def start(self, task_id: int) -> TaskRead:
        task = self._own_task(task_id)
        self._set_status(task, TaskStatus.IN_PROGRESS)
        task.started_at = self._clock.now()
        started = self._by_user(CaseEventType.WORK_STARTED, {"task_id": task.id})
        self._move(task.case, CaseStatus.IN_PROGRESS, started)
        return self._commit(task)

    def complete(self, task_id: int, data: CompleteRequest) -> TaskRead:
        task = self._own_task(task_id)
        self._set_status(task, TaskStatus.COMPLETED)
        task.completed_at = self._clock.now()
        task.completion_note = data.completion_note
        case = task.case
        completed = self._by_user(CaseEventType.WORK_COMPLETED, {"task_id": task.id})
        self._move(case, CaseStatus.RESOLVED, completed)
        self._auto_close(case)
        return self._commit(task)

    def decline(self, task_id: int, data: DeclineRequest) -> TaskRead:
        task = self._own_task(task_id)
        self._set_status(task, TaskStatus.DECLINED)
        task.declined_reason = data.reason
        task.case.assigned_staff_id = None
        declined = self._by_user(
            CaseEventType.TASK_DECLINED, {"task_id": task.id, "reason": data.reason}
        )
        self._move(task.case, CaseStatus.ESCALATED, declined)
        return self._commit(task)

    # --- Yardimcilar ---------------------------------------------------------------------

    def _auto_close(self, case: Case) -> None:
        for target, event in (
            (CaseStatus.VERIFICATION, CaseEventType.RESOLUTION_EVALUATED),
            (CaseStatus.CLOSED, CaseEventType.CASE_CLOSED),
        ):
            system = Transition(
                event_type=event, actor_type=ActorType.SYSTEM, metadata={"rule": AUTO_CLOSE_RULE}
            )
            self._move(case, target, system)

    def _cancel_active_task(self, case: Case) -> None:
        active = task_repository.active_for_case(self._session, case.id, list(ACTIVE_TASK_STATUSES))
        if active is None:
            return
        self._set_status(active, TaskStatus.CANCELLED)
        reassigned = self._by_user(CaseEventType.TASK_REASSIGNED, {"task_id": active.id})
        self._workflow.record(case, reassigned, self._clock.now())

    def _move(self, case: Case, target: CaseStatus, transition: Transition) -> None:
        self._workflow.transition(case, target, transition)

    def _by_user(self, event: CaseEventType, metadata: dict[str, Any]) -> Transition:
        return Transition(
            event_type=event, actor_type=ActorType.USER, actor_id=self._actor.id, metadata=metadata
        )

    def _set_status(self, task: Task, target: TaskStatus) -> None:
        ensure_task_transition_allowed(task.status, target)
        task.status = target

    def _own_task(self, task_id: int) -> Task:
        task = self._visible_task(task_id)
        if self._actor.role is not UserRole.STAFF:
            raise ForbiddenError()
        return task

    def _visible_task(self, task_id: int) -> Task:
        task = task_repository.get(self._session, task_id)
        if task is None:
            raise NotFoundError()
        ensure_can_view_task(self._actor, task)
        return task

    def _visible_case(self, case_id: int) -> Case:
        case = case_repository.get(self._session, case_id)
        if case is None:
            raise NotFoundError()
        ensure_can_view_case(self._actor, case)
        return case

    def _ensure_department(self, department_id: int) -> None:
        department = department_repository.get(self._session, department_id)
        if department is None or not department.is_active:
            raise NotFoundError()
        ensure_same_organization(self._actor, resource_organization_id=department.organization_id)

    def _ensure_assignee(self, user_id: int, department_id: int) -> None:
        user = user_repository.get_by_id(self._session, user_id)
        valid = (
            user is not None
            and user.is_active
            and user.role is UserRole.STAFF
            and user.department_id == department_id
            and user.organization_id == self._actor.organization_id
        )
        if not valid:
            raise InvalidAssigneeError()

    def _commit(self, task: Task) -> TaskRead:
        self._session.commit()
        refreshed = task_repository.get(self._session, task.id)
        if refreshed is None:
            raise NotFoundError()
        return to_read(refreshed, self._clock.now())


def to_read(task: Task, now: datetime) -> TaskRead:
    case = task.case
    return TaskRead.model_validate(
        {
            "id": task.id,
            "case_id": case.id,
            "case_number": case.case_number,
            "title": task.title,
            "description": case.description,
            "status": task.status,
            "department": task.department,
            "assigned_user_id": task.assigned_user_id,
            "location": case.location,
            "priority": case.priority,
            "created_at": task.created_at,
            "accepted_at": task.accepted_at,
            "started_at": task.started_at,
            "completed_at": task.completed_at,
            "completion_note": task.completion_note,
            "declined_reason": task.declined_reason,
            "due_at": case.due_at,
            "sla_status": case_sla_status(case, now),
        },
        from_attributes=True,
    )
