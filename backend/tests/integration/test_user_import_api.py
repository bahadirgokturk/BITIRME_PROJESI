"""Toplu kullanici yukleme (CSV): hepsi ya da hicbiri; once deneme (dry_run) ile hatalar gorulur."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, User
from app.models.enums import UserRole
from tests.integration.factories import (
    DEFAULT_PASSWORD,
    bearer,
    make_department,
    make_organization,
    make_user,
)

URL = "/api/v1/admin/users/import"
TEMPORARY = "gecici-parola-1"
Headers = dict[str, str]
GOOD = (
    "email,full_name,role,reporter_kind,department_code\n"
    "ogrenci@kampus.edu.tr,Ali Veli,REPORTER,STUDENT,\n"
    "Temizlik@Kampus.edu.tr,Ayşe Işık,STAFF,,SUPPORT_SERVICES\n"
)


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> Headers:
    organization = make_organization(db_session)
    make_department(db_session, organization, "SUPPORT_SERVICES")
    make_user(
        db_session, email="admin@kampus.edu.tr", role=UserRole.ADMIN, organization=organization
    )
    return bearer(client, "admin@kampus.edu.tr")


def _upload(client: TestClient, headers: Headers, csv: str, *, dry_run: bool = False) -> dict:
    response = client.post(
        URL,
        params={"dry_run": dry_run},
        files={"file": ("kullanicilar.csv", csv.encode(), "text/csv")},
        data={"password": TEMPORARY},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body: dict = response.json()
    return body


def _count(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(User)) or 0


def test_valid_file_creates_every_user_with_a_temporary_password(
    client: TestClient, db_session: Session, admin: Headers
) -> None:
    result = _upload(client, admin, GOOD)

    assert result == {"created": 2, "errors": [], "dry_run": False}
    staff = db_session.scalars(select(User).where(User.email == "temizlik@kampus.edu.tr")).one()
    assert staff.must_change_password is True
    assert staff.department_id is not None
    assert bearer(client, "temizlik@kampus.edu.tr", TEMPORARY)
    created = db_session.scalars(select(AuditLog.action).where(AuditLog.action == "USER_CREATED"))
    assert len(list(created)) == 2


def test_dry_run_reports_without_creating(
    client: TestClient, db_session: Session, admin: Headers
) -> None:
    before = _count(db_session)

    result = _upload(client, admin, GOOD, dry_run=True)

    assert result == {"created": 2, "errors": [], "dry_run": True}
    assert _count(db_session) == before


def test_any_bad_row_stops_the_whole_import_and_every_problem_is_listed(
    client: TestClient, db_session: Session, admin: Headers
) -> None:
    before = _count(db_session)
    csv = (
        "email,full_name,role,reporter_kind,department_code\n"
        "iyi@kampus.edu.tr,İyi Satır,REPORTER,STUDENT,\n"  # 2: dogru
        "eposta-degil,Ali,REPORTER,STUDENT,\n"  # 3
        "admin@kampus.edu.tr,Zaten Var,ADMIN,,\n"  # 4
        "iyi@kampus.edu.tr,Tekrar,REPORTER,STUDENT,\n"  # 5
        "x@kampus.edu.tr,X,PATRON,,\n"  # 6
        "y@kampus.edu.tr,Y,STAFF,,YOK_BOYLE\n"  # 7
        "z@kampus.edu.tr,Z,STAFF,,\n"  # 8: personelde birim zorunlu
    )

    result = _upload(client, admin, csv)

    assert result["created"] == 0
    assert [e["row"] for e in result["errors"]] == [3, 4, 5, 6, 7, 8]
    messages = " | ".join(e["message"] for e in result["errors"])
    assert "e-posta" in messages
    assert "zaten kayıtlı" in messages
    assert "YOK_BOYLE" in messages
    assert _count(db_session) == before


def test_structural_problems_and_permissions(
    client: TestClient, db_session: Session, admin: Headers
) -> None:
    files = {"file": ("x.csv", b"email,full_name\nali@x.edu.tr,Ali\n", "text/csv")}
    data = {"password": TEMPORARY}

    missing_column = client.post(URL, files=files, data=data, headers=admin)
    short_password = client.post(
        URL,
        files={"file": ("x.csv", GOOD.encode(), "text/csv")},
        data={"password": "kisa"},
        headers=admin,
    )

    assert missing_column.status_code == 422
    assert missing_column.json()["error"]["code"] == "INVALID_IMPORT_FILE"
    assert short_password.status_code == 422
    make_user(db_session, email="mudur@kampus.edu.tr", role=UserRole.MANAGER)
    manager = bearer(client, "mudur@kampus.edu.tr", DEFAULT_PASSWORD)
    assert client.post(URL, files=files, data=data, headers=manager).status_code == 403


def test_large_file_is_refused(client: TestClient, admin: Headers) -> None:
    big = b"email,full_name,role\n" + b"x" * (2 * 1024 * 1024)

    response = client.post(
        URL, files={"file": ("x.csv", big, "text/csv")}, data={"password": TEMPORARY}, headers=admin
    )

    assert response.status_code == 413
