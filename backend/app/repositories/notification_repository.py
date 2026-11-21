from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Notification, User
from app.models.enums import UserRole
from app.schemas.common import PageParams


def add_all(session: Session, notifications: Sequence[Notification]) -> None:
    session.add_all(notifications)


def staff_of(session: Session, department_id: int) -> list[int]:
    return list(
        session.scalars(
            select(User.id).where(
                User.department_id == department_id,
                User.role == UserRole.STAFF,
                User.is_active.is_(True),
            )
        )
    )


def managers_of(session: Session, organization_id: int, department_id: int | None) -> list[int]:
    """Birimin aktif mudurleri; birim yoksa ya da birimin muduru yoksa kurumun butun mudurleri."""
    scope = select(User.id).where(
        User.organization_id == organization_id,
        User.role == UserRole.MANAGER,
        User.is_active.is_(True),
    )
    if department_id is not None:
        own = list(session.scalars(scope.where(User.department_id == department_id)))
        if own:
            return own
    return list(session.scalars(scope))


def list_page(
    session: Session, user_id: int, paging: PageParams, *, unread_only: bool
) -> tuple[Sequence[Notification], int]:
    scope = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        scope = scope.where(Notification.read_at.is_(None))
    total = session.scalar(select(func.count()).select_from(scope.subquery())) or 0
    items = session.scalars(
        scope.order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset(paging.offset)
        .limit(paging.page_size)
    ).all()
    return items, total


def unread_count(session: Session, user_id: int) -> int:
    statement = select(func.count()).where(
        Notification.user_id == user_id, Notification.read_at.is_(None)
    )
    return session.scalar(statement) or 0


def get_own(session: Session, notification_id: int, user_id: int) -> Notification | None:
    return session.scalars(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    ).one_or_none()


def mark_all_read(session: Session, user_id: int, now: datetime) -> None:
    session.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=now)
    )
