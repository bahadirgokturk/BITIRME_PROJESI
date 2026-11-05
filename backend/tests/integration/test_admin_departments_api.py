"""Admin departman yonetimi: kurum kapsami (IDOR), tekil kod, soft delete."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.integration.factories import login_headers

URL = "/api/v1/admin/departments"
Headers = dict[str, str]


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> Headers:
    return login_headers(client, db_session, email="admin@kampus-a.edu.tr")


@pytest.fixture
def other_admin(client: TestClient, db_session: Session) -> Headers:
    # Baska bir kurumun yoneticisi (login_headers her kullanici icin yeni kurum acar)
    return login_headers(client, db_session, email="admin@kampus-b.edu.tr")


def _create(client: TestClient, headers: Headers, code: str = "CLEANING") -> dict[str, object]:
    response = client.post(URL, json={"code": code, "name": "Temizlik"}, headers=headers)
    assert response.status_code == 201, response.text
    body: dict[str, object] = response.json()
    return body


def test_create_and_list(client: TestClient, admin: Headers) -> None:
    created = _create(client, admin)

    listing = client.get(URL, headers=admin).json()

    assert created["code"] == "CLEANING"
    assert created["is_active"] is True
    assert listing["total"] == 1
    assert listing["items"][0]["id"] == created["id"]


def test_duplicate_code_in_same_organization_is_409(client: TestClient, admin: Headers) -> None:
    _create(client, admin)

    response = client.post(URL, json={"code": "CLEANING", "name": "Başka"}, headers=admin)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_same_code_in_another_organization_is_allowed(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    _create(client, admin)

    _create(client, other_admin)


def test_admin_only_sees_own_organization(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    _create(client, other_admin, code="SECURITY")

    assert client.get(URL, headers=admin).json()["total"] == 0


def test_update_name_and_deactivate(client: TestClient, admin: Headers) -> None:
    created = _create(client, admin)

    response = client.patch(
        f"{URL}/{created['id']}",
        json={"name": "Temizlik Birimi", "is_active": False},
        headers=admin,
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Temizlik Birimi"
    assert response.json()["is_active"] is False


def test_updating_another_organizations_department_is_404(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    # IDOR: ID'yi tahmin etmek yetmez; kayit "yok" gibi gorunur
    foreign = _create(client, other_admin)

    response = client.patch(f"{URL}/{foreign['id']}", json={"name": "Ele gecirildi"}, headers=admin)

    assert response.status_code == 404


def test_pagination(client: TestClient, admin: Headers) -> None:
    for index in range(3):
        _create(client, admin, code=f"DEPT_{index}")

    page = client.get(URL, params={"page": 2, "page_size": 2}, headers=admin).json()

    assert page["total"] == 3
    assert page["page"] == 2
    assert len(page["items"]) == 1
