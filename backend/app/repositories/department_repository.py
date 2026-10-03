from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Department
from app.schemas.common import PageParams


def list_page(
    session: Session, organization_id: int, paging: PageParams
) -> tuple[Sequence[Department], int]:
    scope = select(Department).where(Department.organization_id == organization_id)
    total = session.scalar(select(func.count()).select_from(scope.subquery())) or 0
    items = session.scalars(
        scope.order_by(Department.code).offset(paging.offset).limit(paging.page_size)
    ).all()
    return items, total


def get(session: Session, department_id: int) -> Department | None:
    return session.get(Department, department_id)


def get_by_code(session: Session, organization_id: int, code: str) -> Department | None:
    return session.scalars(
        select(Department).where(
            Department.organization_id == organization_id, Department.code == code
        )
    ).one_or_none()


def add(session: Session, department: Department) -> Department:
    session.add(department)
    session.flush()
    return department


def list_active(session: Session, organization_id: int) -> Sequence[Department]:
    return session.scalars(
        select(Department)
        .where(Department.organization_id == organization_id, Department.is_active.is_(True))
        .order_by(Department.name)
    ).all()


def list_all(session: Session, organization_id: int) -> Sequence[Department]:
    return session.scalars(
        select(Department).where(Department.organization_id == organization_id)
    ).all()
