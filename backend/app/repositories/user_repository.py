from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import User


def get_by_email(session: Session, email: str) -> User | None:
    # E-posta buyuk/kucuk harf duyarsiz eslesir
    statement = select(User).where(func.lower(User.email) == email.lower())
    return session.scalars(statement).one_or_none()


def get_by_id(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)
