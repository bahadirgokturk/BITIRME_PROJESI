from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.common import PageParams


def get_by_email(session: Session, email: str) -> User | None:
    # E-posta buyuk/kucuk harf duyarsiz eslesir
    statement = select(User).where(func.lower(User.email) == email.lower())
    return session.scalars(statement).one_or_none()


def get_by_id(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)


def list_page(
    session: Session, organization_id: int, paging: PageParams
) -> tuple[Sequence[User], int]:
    scope = select(User).where(User.organization_id == organization_id)
    total = session.scalar(select(func.count()).select_from(scope.subquery())) or 0
    items = session.scalars(
        scope.order_by(User.email).offset(paging.offset).limit(paging.page_size)
    ).all()
    return items, total


def add(session: Session, user: User) -> User:
    session.add(user)
    session.flush()
    return user
