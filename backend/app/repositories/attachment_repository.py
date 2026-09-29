from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Attachment


def add(session: Session, attachment: Attachment) -> Attachment:
    session.add(attachment)
    session.flush()
    return attachment


def get(session: Session, attachment_id: int) -> Attachment | None:
    return session.get(Attachment, attachment_id)


def count_for_case(session: Session, case_id: int) -> int:
    statement = select(func.count()).where(Attachment.case_id == case_id)
    return session.scalar(statement) or 0


def list_for_case(session: Session, case_id: int) -> Sequence[Attachment]:
    return session.scalars(
        select(Attachment).where(Attachment.case_id == case_id).order_by(Attachment.id)
    ).all()
