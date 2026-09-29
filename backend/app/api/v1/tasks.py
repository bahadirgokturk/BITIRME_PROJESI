"""Personel gorevleri (FAZ 4, E4-1). Kurallar ve bildirim senkronu app/services/task_service.py'de.

Kanit fotografi ayri uc degil: POST /cases/{id}/attachments personelin yukledigini EVIDENCE sayar.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.database import get_session
from app.models.enums import TaskStatus
from app.schemas.common import Page, PageParams
from app.schemas.task import CompleteRequest, DeclineRequest, TaskRead
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"], responses=AUTHENTICATED_RESPONSES)
Paging = Annotated[PageParams, Depends(page_params)]


def get_task_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
) -> TaskService:
    return TaskService(session, user, clock)


Tasks = Annotated[TaskService, Depends(get_task_service)]


@router.get("/mine")
def list_my_tasks(
    paging: Paging,
    service: Tasks,
    status: Annotated[list[TaskStatus] | None, Query()] = None,
) -> Page[TaskRead]:
    return service.mine(status or [], paging)


@router.get("/{task_id}")
def get_task(task_id: int, service: Tasks) -> TaskRead:
    return service.get(task_id)


@router.post("/{task_id}/accept")
def accept_task(task_id: int, service: Tasks) -> TaskRead:
    return service.accept(task_id)


@router.post("/{task_id}/start")
def start_task(task_id: int, service: Tasks) -> TaskRead:
    return service.start(task_id)


@router.post("/{task_id}/decline")
def decline_task(task_id: int, payload: DeclineRequest, service: Tasks) -> TaskRead:
    return service.decline(task_id, payload)


@router.post("/{task_id}/complete")
def complete_task(task_id: int, payload: CompleteRequest, service: Tasks) -> TaskRead:
    return service.complete(task_id, payload)
