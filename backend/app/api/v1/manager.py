"""Manager inceleme kuyrugu (E5-9).

Duzeltme ve reddetme case_interactions.py'de (/cases/{id}/override, /reject).
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, require_roles
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.database import get_session
from app.models.enums import UserRole
from app.schemas.case import ReviewItemRead
from app.schemas.common import Page, PageParams
from app.services.review_service import ReviewService

router = APIRouter(
    prefix="/manager",
    tags=["manager"],
    responses=AUTHENTICATED_RESPONSES,
    dependencies=[Depends(require_roles(UserRole.MANAGER))],
)


def get_review_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
) -> ReviewService:
    return ReviewService(session, user, clock)


Reviews = Annotated[ReviewService, Depends(get_review_service)]


@router.get("/review-queue")
def review_queue(
    paging: Annotated[PageParams, Depends(page_params)], service: Reviews
) -> Page[ReviewItemRead]:
    """Agent'in yukselttigi (ESCALATED) ya da emin olamadigi bildirimler; en kritik once."""
    return service.queue(paging)
