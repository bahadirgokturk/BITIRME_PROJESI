"""Bildirimler (FAZ 3, E3-1). Is kurallari app/services/case_service.py'de.

Kapsam (docs/WORKFLOW.md bolum 4): REPORTER kendi, STAFF atanmis + departmani,
MANAGER/ADMIN tum kurum. Yetkisiz kayit 404 doner (IDOR).
"""

from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.database import get_session
from app.models.enums import CaseStatus
from app.schemas.case import CaseCreate, CaseEventRead, CaseRead
from app.schemas.common import Page, PageParams
from app.services.case_service import CaseService

router = APIRouter(prefix="/cases", tags=["cases"], responses=AUTHENTICATED_RESPONSES)
Paging = Annotated[PageParams, Depends(page_params)]


def get_case_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
) -> CaseService:
    return CaseService(session, user, clock)


Cases = Annotated[CaseService, Depends(get_case_service)]


@router.post("", status_code=HTTPStatus.CREATED)
def create_case(payload: CaseCreate, service: Cases) -> CaseRead:
    return service.create(payload)


@router.get("")
def list_cases(
    paging: Paging,
    service: Cases,
    status: Annotated[list[CaseStatus] | None, Query()] = None,
) -> Page[CaseRead]:
    return service.search(status or [], paging)


# /mine, /{case_id}'den once tanimlanir; yoksa "mine" bir id sanilir
@router.get("/mine")
def list_my_cases(paging: Paging, service: Cases) -> Page[CaseRead]:
    return service.list_mine(paging)


@router.get("/{case_id}")
def get_case(case_id: int, service: Cases) -> CaseRead:
    return service.get(case_id)


@router.get("/{case_id}/events")
def list_case_events(case_id: int, service: Cases) -> list[CaseEventRead]:
    return service.events(case_id)
