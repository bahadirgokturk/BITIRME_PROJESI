"""Bildirimler (FAZ 3, E3-1). Is kurallari app/services/case_service.py'de.

Kapsam (docs/WORKFLOW.md bolum 4): REPORTER kendi, STAFF atanmis + departmani,
MANAGER/ADMIN tum kurum. Yetkisiz kayit 404 doner (IDOR).
"""

from dataclasses import dataclass
from http import HTTPStatus
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.agents.vision_model import VisionModel
from app.api.deps import Analysis, CurrentUser, get_app_settings, get_vision_model, require_roles
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.config import Settings
from app.core.constants import BYTES_PER_MB, CASE_SEARCH_MAX_LENGTH, IDEMPOTENCY_KEY_MAX_LENGTH
from app.core.database import get_session
from app.models.enums import CaseStatus, Priority, UserRole
from app.schemas.case import AgentDecisionRead, CaseCreate, CaseEventRead, CaseRead, CaseSearch
from app.schemas.common import ListOrder, Page, PageParams
from app.schemas.photo_suggest import PhotoSuggestRead
from app.services.analysis_service import AnalysisLauncher
from app.services.case_service import CaseService
from app.services.photo_suggest_service import PhotoSuggestService

router = APIRouter(prefix="/cases", tags=["cases"], responses=AUTHENTICATED_RESPONSES)
Paging = Annotated[PageParams, Depends(page_params)]


def get_case_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
) -> CaseService:
    return CaseService(session, user, clock)


Cases = Annotated[CaseService, Depends(get_case_service)]
REPLAYED_HEADER = "Idempotent-Replayed"


@dataclass(frozen=True)
class CreateOptionsData:
    key: str | None
    response: Response
    analysis: AnalysisLauncher | None


def create_options(
    response: Response,
    analysis: Analysis,
    key: Annotated[
        str | None,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=IDEMPOTENCY_KEY_MAX_LENGTH,
            description="Istemcinin gonderim anahtari (UUID); tekrar gonderimde cift kayit olusmaz",
        ),
    ] = None,
) -> CreateOptionsData:
    return CreateOptionsData(key, response, analysis)


CreateOptions = Annotated[CreateOptionsData, Depends(create_options)]


def get_photo_suggest_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    vision: Annotated[VisionModel | None, Depends(get_vision_model)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> PhotoSuggestService:
    return PhotoSuggestService(session, user, vision, settings.max_upload_mb * BYTES_PER_MB)


PhotoSuggest = Annotated[PhotoSuggestService, Depends(get_photo_suggest_service)]


@router.post("/photo-suggest")
async def suggest_from_photo(file: UploadFile, service: PhotoSuggest) -> PhotoSuggestRead:
    """Fotograftan tur onerisi (Vision Agent); fotograf saklanmaz. Model yoksa `available` false."""
    return service.suggest(await file.read())


@router.post("", status_code=HTTPStatus.CREATED)
def create_case(
    payload: CaseCreate, service: Cases, background: BackgroundTasks, extra: CreateOptions
) -> CaseRead:
    """Yanit ANALYZING doner; agent hatti yanittan sonra calisir (docs/AGENTS.md bolum 3).

    Idempotency-Key verilirse ayni anahtarli tekrar gonderim ilk bildirimi dondurur
    (Idempotent-Replayed: true); agent hatti ikinci kez calismaz.
    """
    if extra.key is None:
        created = service.create(payload)
    else:
        creation = service.create_once(payload, extra.key)
        created = creation.case
        if creation.replayed:
            extra.response.headers[REPLAYED_HEADER] = "true"
            return created
    if extra.analysis is not None:
        extra.analysis.schedule(background, created.id)
    return created


def case_search(
    status: Annotated[list[CaseStatus] | None, Query()] = None,
    priority: Annotated[list[Priority] | None, Query()] = None,
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
    order: ListOrder = ListOrder.NEWEST,
) -> CaseSearch:
    text = q.strip() if q else ""
    return CaseSearch(
        statuses=status or [],
        priorities=priority or [],
        breached_only=sla_status is not None,
        text=text or None,
        order=order,
    )


@router.get("")
def list_cases(
    paging: Paging, service: Cases, search: Annotated[CaseSearch, Depends(case_search)]
) -> Page[CaseRead]:
    """Kapsamdaki bildirimler, en yeni once; total suzulmus sayidir."""
    return service.search(search, paging)


# /mine, /{case_id}'den once tanimlanir; yoksa "mine" bir id sanilir
@router.get("/mine")
def list_my_cases(
    paging: Paging, service: Cases, search: Annotated[CaseSearch, Depends(case_search)]
) -> Page[CaseRead]:
    """Kendi bildirimlerim; GET /cases ile ayni suzgec ve siralama secenekleri."""
    return service.list_mine(search, paging)


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
