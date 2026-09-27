"""Bildirimler (FAZ 3, E3-1/E3-2). Sozlesme: sema yayinda, is mantigi sonraki PR'larda (501).

Kapsam kurallari (docs/WORKFLOW.md bolum 4): REPORTER kendi, STAFF atanmis + departmani,
MANAGER/ADMIN tum kurum. Yetkisiz kayit 404 doner (IDOR).
"""

from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.errors import NotImplementedYetError
from app.models.enums import CaseStatus
from app.schemas.case import CaseCreate, CaseEventRead, CaseRead
from app.schemas.common import Page, PageParams

router = APIRouter(prefix="/cases", tags=["cases"], responses=AUTHENTICATED_RESPONSES)
Paging = Annotated[PageParams, Depends(page_params)]


@router.post("", status_code=HTTPStatus.CREATED)
def create_case(_payload: CaseCreate, _user: CurrentUser) -> CaseRead:
    raise NotImplementedYetError()


@router.get("")
def list_cases(
    _paging: Paging,
    _user: CurrentUser,
    _status: Annotated[list[CaseStatus] | None, Query(alias="status")] = None,
) -> Page[CaseRead]:
    raise NotImplementedYetError()


# /mine, /{case_id}'den once tanimlanir; yoksa "mine" bir id sanilir
@router.get("/mine")
def list_my_cases(_paging: Paging, _user: CurrentUser) -> Page[CaseRead]:
    raise NotImplementedYetError()


@router.get("/{case_id}")
def get_case(case_id: int, _user: CurrentUser) -> CaseRead:
    raise NotImplementedYetError()


@router.get("/{case_id}/events")
def list_case_events(case_id: int, _user: CurrentUser) -> list[CaseEventRead]:
    raise NotImplementedYetError()
