"""Personel gorevleri (FAZ 4, E4-1). Sozlesme: sema yayinda, is mantigi sonraki PR'da (501).

Kanit fotografi ayri uc degil: POST /cases/{id}/attachments personelin yukledigini EVIDENCE sayar.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.errors import NotImplementedYetError
from app.models.enums import TaskStatus
from app.schemas.common import Page, PageParams
from app.schemas.task import CompleteRequest, DeclineRequest, TaskRead

router = APIRouter(prefix="/tasks", tags=["tasks"], responses=AUTHENTICATED_RESPONSES)
Paging = Annotated[PageParams, Depends(page_params)]


@router.get("/mine")
def list_my_tasks(
    _paging: Paging,
    _user: CurrentUser,
    _status: Annotated[list[TaskStatus] | None, Query(alias="status")] = None,
) -> Page[TaskRead]:
    raise NotImplementedYetError()


@router.get("/{task_id}")
def get_task(task_id: int, _user: CurrentUser) -> TaskRead:
    raise NotImplementedYetError()


@router.post("/{task_id}/accept")
def accept_task(task_id: int, _user: CurrentUser) -> TaskRead:
    raise NotImplementedYetError()


@router.post("/{task_id}/start")
def start_task(task_id: int, _user: CurrentUser) -> TaskRead:
    raise NotImplementedYetError()


@router.post("/{task_id}/decline")
def decline_task(task_id: int, _payload: DeclineRequest, _user: CurrentUser) -> TaskRead:
    raise NotImplementedYetError()


@router.post("/{task_id}/complete")
def complete_task(task_id: int, _payload: CompleteRequest, _user: CurrentUser) -> TaskRead:
    raise NotImplementedYetError()
