"""Admin kullanici listesinde arama ve suzme: toplu yuklemeden sonra binlerce kullanici olur."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from tests.integration.factories import bearer, make_department, make_organization, make_user

URL = "/api/v1/admin/users"
Headers = dict[str, str]


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> tuple[Headers, int]:
    organization = make_organization(db_session)
    support = make_department(db_session, organization, "SUPPORT_SERVICES")
    admin = make_user(
        db_session, email="admin@kampus.edu.tr", role=UserRole.ADMIN, organization=organization
    )
    admin.full_name = "Sistem Yöneticisi"
    people = [
        ("ayse.isik@ogr.kampus.edu.tr", UserRole.REPORTER, None, True),
        ("mehmet@kampus.edu.tr", UserRole.STAFF, support.id, True),
        ("eski.personel@kampus.edu.tr", UserRole.STAFF, support.id, False),
    ]
    for email, role, department_id, active in people:
        user = make_user(
            db_session,
            email=email,
            role=role,
            organization=organization,
            department_id=department_id,
            is_active=active,
        )
        # Fabrikanin varsayilan adi herkeste ayni; aramada ayirt edilsin diye
        user.full_name = "Ayşe Işık" if email.startswith("ayse") else email.split("@")[0]
    db_session.flush()
    # Baska kurumun kullanicisi aramada hic cikmaz
    make_user(db_session, email="ayse@baska.edu.tr")
    return bearer(client, "admin@kampus.edu.tr"), support.id


def _emails(client: TestClient, headers: Headers, **params: object) -> list[str]:
    response = client.get(URL, params=params, headers=headers)
    assert response.status_code == 200, response.text
    return [u["email"] for u in response.json()["items"]]


def test_search_ignores_turkish_letters_and_case(
    client: TestClient, admin: tuple[Headers, int]
) -> None:
    headers, _ = admin

    assert _emails(client, headers, q="AYSE ISIK") == ["ayse.isik@ogr.kampus.edu.tr"]
    assert _emails(client, headers, q="ayşe") == ["ayse.isik@ogr.kampus.edu.tr"]
    # E-postada da arar
    assert _emails(client, headers, q="mehmet@") == ["mehmet@kampus.edu.tr"]
    # LIKE joker karakterleri metin sayilir
    assert _emails(client, headers, q="%") == []


def test_filters_combine(client: TestClient, admin: tuple[Headers, int]) -> None:
    headers, support_id = admin

    staff = _emails(client, headers, role="STAFF")
    active_staff = _emails(client, headers, role="STAFF", is_active=True)
    in_support = _emails(client, headers, department_id=support_id)

    assert staff == ["eski.personel@kampus.edu.tr", "mehmet@kampus.edu.tr"]
    assert active_staff == ["mehmet@kampus.edu.tr"]
    assert in_support == staff


def test_total_counts_the_filtered_list(client: TestClient, admin: tuple[Headers, int]) -> None:
    headers, _ = admin

    body = client.get(URL, params={"role": "STAFF", "page_size": 1}, headers=headers).json()

    assert body["total"] == 2
    assert len(body["items"]) == 1
