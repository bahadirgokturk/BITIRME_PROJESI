from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CaseType


def get_by_code(session: Session, organization_id: int, code: str) -> CaseType | None:
    return session.scalars(
        select(CaseType).where(CaseType.organization_id == organization_id, CaseType.code == code)
    ).one_or_none()


def add(session: Session, case_type: CaseType) -> CaseType:
    session.add(case_type)
    session.flush()
    return case_type
