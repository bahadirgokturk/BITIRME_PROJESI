from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, User
from app.schemas.audit import AuditLogFilter
from app.schemas.common import PageParams


def add(session: Session, entry: AuditLog) -> AuditLog:
    session.add(entry)
    session.flush()
    return entry


def list_page(
    session: Session, organization_id: int, filters: AuditLogFilter, paging: PageParams
) -> tuple[list[tuple[AuditLog, str]], int]:
    """(kayit, islemi yapanin adi), en yeni once."""
    scope = select(AuditLog).where(AuditLog.organization_id == organization_id)
    if filters.entity_type is not None:
        scope = scope.where(AuditLog.entity_type == filters.entity_type)
    if filters.entity_id is not None:
        scope = scope.where(AuditLog.entity_id == filters.entity_id)
    total = session.scalar(select(func.count()).select_from(scope.subquery())) or 0
    rows = session.execute(
        scope.add_columns(User.full_name)
        .join(User, User.id == AuditLog.user_id)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(paging.offset)
        .limit(paging.page_size)
    ).all()
    return [(row[0], row[1]) for row in rows], total
