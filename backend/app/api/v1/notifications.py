"""Zil: giris yapan kullanicinin kisiye ozel bildirimleri (her rol)."""

from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.api.v1.pagination import page_params
from app.api.v1.responses import AUTHENTICATED_RESPONSES
from app.core.clock import Clock, get_clock
from app.core.database import get_session
from app.schemas.common import Page, PageParams
from app.schemas.notification import NotificationRead, UnreadCount
from app.services.notification_service import NotificationService

router = APIRouter(
    prefix="/notifications", tags=["notifications"], responses=AUTHENTICATED_RESPONSES
)
Paging = Annotated[PageParams, Depends(page_params)]


def get_notification_service(
    session: Annotated[Session, Depends(get_session)],
    user: CurrentUser,
    clock: Annotated[Clock, Depends(get_clock)],
) -> NotificationService:
    return NotificationService(session, user, clock)


Notifications = Annotated[NotificationService, Depends(get_notification_service)]


@router.get("")
def list_notifications(
    paging: Paging, service: Notifications, unread_only: bool = False
) -> Page[NotificationRead]:
    """Yeniden eskiye."""
    return service.list(paging, unread_only=unread_only)


@router.get("/unread-count")
def unread_count(service: Notifications) -> UnreadCount:
    """Zil rozeti icin; istemci birkac dakikada bir sorar."""
    return service.unread_count()


@router.post("/read-all", status_code=HTTPStatus.NO_CONTENT)
def mark_all_read(service: Notifications) -> None:
    service.mark_all_read()


@router.post("/{notification_id}/read", status_code=HTTPStatus.NO_CONTENT)
def mark_read(notification_id: int, service: Notifications) -> None:
    service.mark_read(notification_id)
