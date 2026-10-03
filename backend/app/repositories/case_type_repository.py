from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CaseType


def get_by_code(session: Session, organization_id: int, code: str) -> CaseType | None:
    return session.scalars(
        select(CaseType).where(CaseType.organization_id == organization_id, CaseType.code == code)
    ).one_or_none()


def list_active(session: Session, organization_id: int) -> Sequence[CaseType]:
    return session.scalars(
        select(CaseType)
        .where(CaseType.organization_id == organization_id, CaseType.is_active.is_(True))
        .order_by(CaseType.name)
    ).all()


def names_by_code(session: Session, organization_id: int) -> dict[str, str]:
    """Tur kodu -> okunur ad (pasif turler dahil: eski kararlar da adlandirilir)."""
    rows = session.execute(
        select(CaseType.code, CaseType.name).where(CaseType.organization_id == organization_id)
    ).all()
    return {code: name for code, name in rows}


def add(session: Session, case_type: CaseType) -> CaseType:
    session.add(case_type)
    session.flush()
    return case_type
