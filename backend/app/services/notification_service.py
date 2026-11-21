"""Kullanicinin kendi bildirimleri: listele, okunmamis sayisi, okundu isaretle.

Her istek yalniz giris yapan kullanicinin kayitlarina bakar; baskasinin bildirimi 404 (IDOR).
Uretim kurallari: services/notifications.py.
"""

from sqlalchemy.orm import Session

from app.core.clock import Clock
from app.core.errors import NotFoundError
from app.models import User
from app.repositories import notification_repository
from app.schemas.common import Page, PageParams
from app.schemas.notification import NotificationRead, UnreadCount


class NotificationService:
    def __init__(self, session: Session, user: User, clock: Clock) -> None:
        self._session = session
        self._user = user
        self._clock = clock

    def list(self, paging: PageParams, *, unread_only: bool) -> Page[NotificationRead]:
        items, total = notification_repository.list_page(
            self._session, self._user.id, paging, unread_only=unread_only
        )
        return Page(
            items=[NotificationRead.model_validate(n, from_attributes=True) for n in items],
            total=total,
            page=paging.page,
        )

    def unread_count(self) -> UnreadCount:
        return UnreadCount(count=notification_repository.unread_count(self._session, self._user.id))

    def mark_read(self, notification_id: int) -> None:
        notification = notification_repository.get_own(
            self._session, notification_id, self._user.id
        )
        if notification is None:
            raise NotFoundError()
        # Ikinci kez okunursa ilk okunma zamani korunur
        notification.read_at = notification.read_at or self._clock.now()
        self._session.commit()

    def mark_all_read(self) -> None:
        notification_repository.mark_all_read(self._session, self._user.id, self._clock.now())
        self._session.commit()
