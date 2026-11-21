from collections.abc import Sequence

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session

from app.models import User
from app.repositories.text_search import fold, folded
from app.schemas.common import PageParams
from app.schemas.user import UserListFilter


def get_by_email(session: Session, email: str) -> User | None:
    # E-posta buyuk/kucuk harf duyarsiz eslesir
    statement = select(User).where(func.lower(User.email) == email.lower())
    return session.scalars(statement).one_or_none()


def get_by_id(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)


def list_page(
    session: Session, organization_id: int, filters: UserListFilter, paging: PageParams
) -> tuple[Sequence[User], int]:
    scope = select(User).where(User.organization_id == organization_id, *_conditions(filters))
    total = session.scalar(select(func.count()).select_from(scope.subquery())) or 0
    items = session.scalars(
        scope.order_by(User.email).offset(paging.offset).limit(paging.page_size)
    ).all()
    return items, total


def _conditions(filters: UserListFilter) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = []
    if filters.q:
        needle = fold(filters.q.strip())
        conditions.append(
            or_(
                folded(User.full_name).contains(needle, autoescape=True),
                func.lower(User.email).contains(needle, autoescape=True),
            )
        )
    exact = {
        User.role: filters.role,
        User.department_id: filters.department_id,
        User.is_active: filters.is_active,
    }
    conditions += [column == value for column, value in exact.items() if value is not None]
    return conditions


def add(session: Session, user: User) -> User:
    session.add(user)
    session.flush()
    return user
