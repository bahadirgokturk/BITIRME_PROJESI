"""Bildirimler (FAZ 3, E3-1). Is kurallari app/services/case_service.py'de.

Kapsam (docs/WORKFLOW.md bolum 4): REPORTER kendi, STAFF atanmis + departmani,
MANAGER/ADMIN tum kurum. Yetkisiz kayit 404 doner (IDOR).
"""

from http import HTTPStatus
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import Analysis, CurrentUser, require_roles
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.constants import CASE_SEARCH_MAX_LENGTH
from app.core.database import get_session
from app.models.enums import CaseStatus, Priority, UserRole
from app.schemas.case import AgentDecisionRead, CaseCreate, CaseEventRead, CaseRead, CaseSearch
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
def create_case(
    payload: CaseCreate, service: Cases, background: BackgroundTasks, analysis: Analysis
) -> CaseRead:
    """Yanit ANALYZING doner; agent hatti yanittan sonra calisir (docs/AGENTS.md bolum 3)."""
    created = service.create(payload)
    if analysis is not None:
        analysis.schedule(background, created.id)
    return created


def case_search(
    status: Annotated[list[CaseStatus] | None, Query()] = None,
    priority: Priority | None = None,
    sla_status: Annotated[
        Literal["BREACHED"] | None, Query(description="Yalniz SLA'si asilan bildirimler")
    ] = None,
    q: Annotated[
        str | None,
        Query(
            max_length=CASE_SEARCH_MAX_LENGTH,
            description="Numara, baslik ya da konum adinda arama (Turkce harflere duyarsiz)",
        ),
    ] = None,
) -> CaseSearch:
    text = q.strip() if q else ""
    return CaseSearch(
        statuses=status or [],
        priority=priority,
        breached_only=sla_status is not None,
        text=text or None,
    )


@router.get("")
def list_cases(
    paging: Paging, service: Cases, search: Annotated[CaseSearch, Depends(case_search)]
) -> Page[CaseRead]:
    """Kapsamdaki bildirimler, en yeni once; total suzulmus sayidir."""
    return service.search(search, paging)


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


@router.get(
    "/{case_id}/decisions",
    dependencies=[Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN))],
)
def list_case_decisions(case_id: int, service: Cases) -> list[AgentDecisionRead]:
    """Agent kararlari gerekceleriyle (E5-8b); kosu sirasiyla."""
    return service.decisions(case_id)
