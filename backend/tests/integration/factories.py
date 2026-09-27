"""Integration testleri icin kucuk veri ureticileri (seed degil; yalniz testte)."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Department, Location, Organization, User
from app.models.enums import LocationKind, ReporterKind, UserRole

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
    organization: Organization | None = None,
    department_id: int | None = None,
) -> User:
    # Kurum verilmezse her kullanici kendi kurumunda olur (IDOR testleri icin kullanisli)
    organization = organization or make_organization(session)
    user = User(
        organization_id=organization.id,
        department_id=department_id,
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


def make_department(session: Session, organization: Organization, code: str) -> Department:
    department = Department(organization_id=organization.id, code=code, name=code)
    session.add(department)
    session.flush()
    return department


def make_location(
    session: Session, organization: Organization, code: str = "B-2-WCM", *, is_active: bool = True
) -> Location:
    location = Location(
        organization_id=organization.id,
        kind=LocationKind.WC,
        code=code,
        name=f"{code} Tuvalet",
        path=code,
        importance_weight=50,
        is_active=is_active,
    )
    session.add(location)
    session.flush()
    return location


def bearer(client: TestClient, email: str, password: str = DEFAULT_PASSWORD) -> dict[str, str]:
    """Var olan kullanici icin giris yapar ve Authorization basligini dondurur."""
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
