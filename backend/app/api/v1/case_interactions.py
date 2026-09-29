"""Bildirim yorumlari, geri bildirim ve yeniden acma (E3-5); kurallar servis katmaninda."""

from http import HTTPStatus
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.database import get_session
from app.schemas.case import CaseRead, CommentCreate, CommentRead, FeedbackCreate, ReopenRequest
from app.schemas.error import ErrorRead
from app.services.case_interaction_service import CaseInteractionService

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
