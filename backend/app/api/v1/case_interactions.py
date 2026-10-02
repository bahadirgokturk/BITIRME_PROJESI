"""Bildirim yorumlari, geri bildirim ve yeniden acma (E3-5); kurallar servis katmaninda."""

from http import HTTPStatus
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.api.deps import Analysis, CurrentUser, require_roles
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.api.v1.tasks import Tasks
from app.core.clock import Clock, get_clock
from app.core.database import get_session
from app.models.enums import UserRole
from app.schemas.case import (
    CaseRead,
    CommentCreate,
    CommentRead,
    FeedbackCreate,
    InfoReplyCreate,
    InfoRequestCreate,
    MergeRequest,
    OverrideRequest,
    RejectRequest,
    ReopenRequest,
)
from app.schemas.error import ErrorRead
from app.schemas.task import AssignRequest
from app.services.case_interaction_service import CaseInteractionService
from app.services.review_service import ReviewService

router = APIRouter(prefix="/cases", tags=["cases"], responses=AUTHENTICATED_RESPONSES)
CONFLICT: dict[int | str, dict[str, Any]] = {HTTPStatus.CONFLICT: {"model": ErrorRead}}


def get_interaction_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
) -> CaseInteractionService:
    return CaseInteractionService(session, user, clock)


Interactions = Annotated[CaseInteractionService, Depends(get_interaction_service)]


@router.post("/{case_id}/comments", status_code=HTTPStatus.CREATED)
def add_comment(case_id: int, payload: CommentCreate, service: Interactions) -> CommentRead:
    return service.add_comment(case_id, payload)


@router.get("/{case_id}/comments")
def list_comments(case_id: int, service: Interactions) -> list[CommentRead]:
    return service.comments(case_id)


@router.post("/{case_id}/feedback", responses=CONFLICT)
def submit_feedback(case_id: int, payload: FeedbackCreate, service: Interactions) -> CaseRead:
    return service.feedback(case_id, payload)


@router.post("/{case_id}/reopen", responses=CONFLICT)
def reopen_case(case_id: int, payload: ReopenRequest, service: Interactions) -> CaseRead:
    return service.reopen(case_id, payload)


@router.post(
    "/{case_id}/request-info",
    dependencies=[Depends(require_roles(UserRole.MANAGER))],
    responses=CONFLICT,
)
def request_info(case_id: int, payload: InfoRequestCreate, service: Interactions) -> CaseRead:
    """Bildirim yapana soru: ANALYZING -> NEEDS_INFO, soru CaseRead.info_request'te doner."""
    return service.request_info(case_id, payload)


@router.post("/{case_id}/info", responses=CONFLICT)
def provide_info(
    case_id: int,
    payload: InfoReplyCreate,
    service: Interactions,
    background: BackgroundTasks,
    analysis: Analysis,
) -> CaseRead:
    """Bildirim yapanin yaniti: NEEDS_INFO -> ANALYZING, yorum olarak da eklenir; agent'lar yeniden
    calisir (yanit aciklamaya eklenerek)."""
    updated = service.provide_info(case_id, payload)
    if analysis is not None:
        analysis.schedule(background, updated.id)
    return updated


@router.post(
    "/{case_id}/assign", dependencies=[Depends(require_roles(UserRole.MANAGER))], responses=CONFLICT
)
def assign_case(case_id: int, payload: AssignRequest, service: Tasks) -> CaseRead:
    """Manager atamasi (E4-1): gorev olusturur, bildirim ASSIGNED olur."""
    return service.assign(case_id, payload)


def get_review_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
) -> ReviewService:
    return ReviewService(session, user, clock)


Reviews = Annotated[ReviewService, Depends(get_review_service)]
MANAGER_ONLY = [Depends(require_roles(UserRole.MANAGER))]


@router.post("/{case_id}/override", dependencies=MANAGER_ONLY)
def override_decision(case_id: int, payload: OverrideRequest, service: Reviews) -> CaseRead:
    """Agent kararini duzelt (tur, oncelik, birim); gerekce zorunlu, decision_feedback'e yazilir."""
    return service.override(case_id, payload)


@router.post("/{case_id}/reject", dependencies=MANAGER_ONLY, responses=CONFLICT)
def reject_case(case_id: int, payload: RejectRequest, service: Reviews) -> CaseRead:
    """Gecersiz/spam bildirimi reddet; atanmis bildirim reddedilemez (409)."""
    return service.reject(case_id, payload)


@router.post("/{case_id}/merge", dependencies=MANAGER_ONLY, responses=CONFLICT)
def merge_case(case_id: int, payload: MergeRequest, service: Reviews) -> CaseRead:
    """Bildirimi ayni sorunun acik ana bildirimine bagla (MERGED); decision_feedback'e yazilir."""
    return service.merge(case_id, payload)
