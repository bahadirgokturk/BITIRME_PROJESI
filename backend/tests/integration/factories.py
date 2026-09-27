"""Integration testleri icin kucuk veri ureticileri (seed degil; yalniz testte)."""

from fastapi.testclient import TestClient
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


def login_headers(
    client: TestClient, session: Session, *, email: str, role: UserRole = UserRole.ADMIN
) -> dict[str, str]:
    """Yeni bir kurumda kullanici olusturur, giris yapar ve Authorization basligini dondurur."""
    make_user(session, email=email, role=role)
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": DEFAULT_PASSWORD}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
