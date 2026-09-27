from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization


def get_by_name(session: Session, name: str) -> Organization | None:
    return session.scalars(select(Organization).where(Organization.name == name)).one_or_none()


def add(session: Session, organization: Organization) -> Organization:
    session.add(organization)
    session.flush()
    return organization
