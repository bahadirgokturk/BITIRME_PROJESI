"""Integration testleri icin kucuk veri ureticileri (seed degil; yalniz testte)."""

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Organization, User
from app.models.enums import ReporterKind, UserRole

DEFAULT_PASSWORD = "dogru-parola-123"


def make_organization(session: Session) -> Organization:
    organization = Organization(name="Test Kampüsü", template_code="campus")
    session.add(organization)
    session.flush()
    return organization


def make_user(
    session: Session,
    *,
    email: str = "ayse@example.edu.tr",
    password: str = DEFAULT_PASSWORD,
    role: UserRole = UserRole.REPORTER,
    is_active: bool = True,
) -> User:
    organization = make_organization(session)
    user = User(
        organization_id=organization.id,
        email=email,
        password_hash=hash_password(password),
        full_name="Ayşe Yılmaz",
        role=role,
        reporter_kind=ReporterKind.STUDENT if role is UserRole.REPORTER else None,
        is_active=is_active,
    )
    session.add(user)
    session.flush()
    return user
