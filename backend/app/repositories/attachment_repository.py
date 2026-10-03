from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Attachment
from app.models.enums import AttachmentKind


def add(session: Session, attachment: Attachment) -> Attachment:
    session.add(attachment)
    session.flush()
    return attachment


def get(session: Session, attachment_id: int) -> Attachment | None:
    return session.get(Attachment, attachment_id)


def count_of_kind(session: Session, case_id: int, kind: AttachmentKind) -> int:
    statement = select(func.count()).where(Attachment.case_id == case_id, Attachment.kind == kind)
    return session.scalar(statement) or 0


def count_evidence(session: Session, case_id: int, user_id: int) -> int:
    """Personelin bu bildirime ekledigi kanit fotograflari (Resolution Agent)."""
    statement = select(func.count()).where(
        Attachment.case_id == case_id,
        Attachment.uploaded_by == user_id,
        Attachment.kind == AttachmentKind.EVIDENCE,
    )
    return session.scalar(statement) or 0


def list_for_case(session: Session, case_id: int) -> Sequence[Attachment]:
    return session.scalars(
        select(Attachment).where(Attachment.case_id == case_id).order_by(Attachment.id)
    ).all()
