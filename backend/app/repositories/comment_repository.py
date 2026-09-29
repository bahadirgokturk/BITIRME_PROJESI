from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Comment


def add(session: Session, comment: Comment) -> Comment:
    session.add(comment)
    session.flush()
    return comment


def list_for_case(session: Session, case_id: int, *, include_internal: bool) -> Sequence[Comment]:
    query = select(Comment).where(Comment.case_id == case_id)
    if not include_internal:
        query = query.where(Comment.is_internal.is_(False))
    return session.scalars(
        query.options(selectinload(Comment.author)).order_by(Comment.created_at, Comment.id)
    ).all()


def get_with_author(session: Session, comment_id: int) -> Comment:
    return session.scalars(
        select(Comment).where(Comment.id == comment_id).options(selectinload(Comment.author))
    ).one()
