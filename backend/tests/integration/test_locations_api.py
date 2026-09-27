"""Bildirim formu icin lokasyon listesi: her rol, yalniz kendi kurumunun aktif yerleri."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from tests.integration.factories import login_headers

URL = "/api/v1/locations"
ADMIN_URL = "/api/v1/admin/locations"
Headers = dict[str, str]


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> Headers:
    return login_headers(client, db_session, email="admin@kampus-a.edu.tr")


def _create(client: TestClient, headers: Headers, code: str, **extra: object) -> int:
    body = {"kind": "BUILDING", "code": code, "name": f"{code} Blok"} | extra
    response = client.post(ADMIN_URL, json=body, headers=headers)
    assert response.status_code == 201, response.text
    location_id: int = response.json()["id"]
    return location_id


def _reporter_in_same_organization(client: TestClient, admin: Headers) -> Headers:
    email = "ogrenci@kampus-a.edu.tr"
    user = {
        "email": email,
        "full_name": "Ali Veli",
        "role": "REPORTER",
        "reporter_kind": "STUDENT",
        "password": "ogrenci-parola-1",
    }
    assert client.post("/api/v1/admin/users", json=user, headers=admin).status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": email, "password": user["password"]})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_reporter_sees_active_locations_of_own_organization(
    client: TestClient, admin: Headers
) -> None:
    active = _create(client, admin, "A")
    inactive = _create(client, admin, "Z")
    client.patch(f"{ADMIN_URL}/{inactive}", json={"is_active": False}, headers=admin)
    reporter = _reporter_in_same_organization(client, admin)

    body = client.get(URL, headers=reporter).json()

    assert [item["id"] for item in body["items"]] == [active]


def test_other_organizations_locations_are_not_listed(
    client: TestClient, db_session: Session, admin: Headers
) -> None:
    _create(client, admin, "A")
    stranger = login_headers(
        client, db_session, email="ogrenci@kampus-b.edu.tr", role=UserRole.REPORTER
    )

    assert client.get(URL, headers=stranger).json()["total"] == 0


def test_option_hides_admin_only_fields(client: TestClient, admin: Headers) -> None:
    _create(client, admin, "A")

    item = client.get(URL, headers=admin).json()["items"][0]

    assert set(item) == {"id", "parent_id", "kind", "code", "name", "path", "aliases"}


def test_login_is_required(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
