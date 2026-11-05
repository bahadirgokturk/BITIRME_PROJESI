"""Admin kullanici yonetimi: kurum kapsami (IDOR), rol kurallari, pasiflestirme, kilitlenme."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from tests.integration.factories import login_headers

URL = "/api/v1/admin/users"
DEPARTMENTS_URL = "/api/v1/admin/departments"
Headers = dict[str, str]
Body = dict[str, object]
PASSWORD = "yeni-parola-123"


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> Headers:
    return login_headers(client, db_session, email="admin@kampus-a.edu.tr")


@pytest.fixture
def other_admin(client: TestClient, db_session: Session) -> Headers:
    return login_headers(client, db_session, email="admin@kampus-b.edu.tr")


def _department(client: TestClient, headers: Headers, code: str = "SUPPORT_SERVICES") -> int:
    response = client.post(DEPARTMENTS_URL, json={"code": code, "name": "Destek"}, headers=headers)
    assert response.status_code == 201, response.text
    department_id: int = response.json()["id"]
    return department_id


def _reporter(**overrides: object) -> Body:
    return {
        "email": "ogrenci@kampus-a.edu.tr",
        "full_name": "Ali Veli",
        "role": "REPORTER",
        "reporter_kind": "STUDENT",
        "password": PASSWORD,
    } | overrides


def _create(client: TestClient, headers: Headers, body: Body) -> Body:
    response = client.post(URL, json=body, headers=headers)
    assert response.status_code == 201, response.text
    created: Body = response.json()
    return created


def _me(client: TestClient, headers: Headers) -> Body:
    me: Body = client.get("/api/v1/auth/me", headers=headers).json()
    return me


def test_created_user_can_log_in_and_password_is_not_returned(
    client: TestClient, admin: Headers
) -> None:
    created = _create(client, admin, _reporter())

    login = client.post(
        "/api/v1/auth/login", json={"email": "ogrenci@kampus-a.edu.tr", "password": PASSWORD}
    )

    assert login.status_code == 200
    assert "password" not in created
    assert "password_hash" not in created


def test_list_only_shows_own_organization(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    _create(client, other_admin, _reporter(email="yabanci@kampus-b.edu.tr"))

    listing = client.get(URL, headers=admin).json()

    # Yalniz admin'in kendisi gorunur
    assert listing["total"] == 1
    assert listing["items"][0]["email"] == "admin@kampus-a.edu.tr"


def test_email_is_unique_case_insensitive(client: TestClient, admin: Headers) -> None:
    _create(client, admin, _reporter())

    response = client.post(URL, json=_reporter(email="OGRENCI@kampus-a.edu.tr"), headers=admin)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_email_is_stored_lowercase(client: TestClient, admin: Headers) -> None:
    created = _create(client, admin, _reporter(email="Ogrenci@Kampus-A.edu.tr"))

    assert created["email"] == "ogrenci@kampus-a.edu.tr"


def test_short_password_is_rejected(client: TestClient, admin: Headers) -> None:
    response = client.post(URL, json=_reporter(password="kisa"), headers=admin)

    assert response.status_code == 422


def test_reporter_kind_on_non_reporter_is_rejected(client: TestClient, admin: Headers) -> None:
    body = _reporter(role="ADMIN", reporter_kind="STUDENT")

    response = client.post(URL, json=body, headers=admin)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_USER_ROLE"


def test_reporter_needs_reporter_kind(client: TestClient, admin: Headers) -> None:
    response = client.post(URL, json=_reporter(reporter_kind=None), headers=admin)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_USER_ROLE"


def test_staff_needs_department(client: TestClient, admin: Headers) -> None:
    body = _reporter(email="personel@kampus-a.edu.tr", role="STAFF", reporter_kind=None)

    response = client.post(URL, json=body, headers=admin)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_USER_ROLE"


def test_staff_with_own_department_is_created(client: TestClient, admin: Headers) -> None:
    department_id = _department(client, admin)
    body = _reporter(
        email="personel@kampus-a.edu.tr",
        role="STAFF",
        reporter_kind=None,
        department_id=department_id,
    )

    created = _create(client, admin, body)

    assert created["department_id"] == department_id


def test_department_of_another_organization_is_404(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    # IDOR: baska kurumun departmani "yok" gibi gorunur
    foreign_department = _department(client, other_admin)
    body = _reporter(
        email="personel@kampus-a.edu.tr",
        role="STAFF",
        reporter_kind=None,
        department_id=foreign_department,
    )

    response = client.post(URL, json=body, headers=admin)

    assert response.status_code == 404


def test_updating_another_organizations_user_is_404(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    foreign = _create(client, other_admin, _reporter(email="yabanci@kampus-b.edu.tr"))

    response = client.patch(f"{URL}/{foreign['id']}", json={"full_name": "X"}, headers=admin)

    assert response.status_code == 404


def test_role_change_is_validated_against_final_state(client: TestClient, admin: Headers) -> None:
    # REPORTER -> STAFF: reporter_kind temizlenmeli ve departman verilmeli
    created = _create(client, admin, _reporter())
    department_id = _department(client, admin)

    response = client.patch(
        f"{URL}/{created['id']}",
        json={"role": "STAFF", "department_id": department_id},
        headers=admin,
    )

    assert response.status_code == 200
    assert response.json()["role"] == "STAFF"
    assert response.json()["reporter_kind"] is None


def test_deactivated_user_loses_access_immediately(client: TestClient, admin: Headers) -> None:
    created = _create(client, admin, _reporter())
    login = client.post(
        "/api/v1/auth/login", json={"email": "ogrenci@kampus-a.edu.tr", "password": PASSWORD}
    )
    user_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    client.patch(f"{URL}/{created['id']}", json={"is_active": False}, headers=admin)

    assert client.get("/api/v1/auth/me", headers=user_headers).status_code == 401
    # Refresh cookie'si de gecersiz: oturum yenilenemez
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_admin_cannot_deactivate_self(client: TestClient, admin: Headers) -> None:
    me = _me(client, admin)

    response = client.patch(f"{URL}/{me['id']}", json={"is_active": False}, headers=admin)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SELF_LOCKOUT"


def test_admin_cannot_demote_self(client: TestClient, admin: Headers) -> None:
    me = _me(client, admin)
    department_id = _department(client, admin)

    response = client.patch(
        f"{URL}/{me['id']}", json={"role": "MANAGER", "department_id": department_id}, headers=admin
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SELF_LOCKOUT"


def test_admin_can_rename_self(client: TestClient, admin: Headers) -> None:
    me = _me(client, admin)

    response = client.patch(f"{URL}/{me['id']}", json={"full_name": "Yeni Ad"}, headers=admin)

    assert response.status_code == 200
    assert response.json()["full_name"] == "Yeni Ad"


def test_manager_cannot_manage_users(client: TestClient, db_session: Session) -> None:
    manager = login_headers(
        client, db_session, email="mudur@kampus-a.edu.tr", role=UserRole.MANAGER
    )

    assert client.get(URL, headers=manager).status_code == 403


def test_reactivated_user_does_not_get_old_session_back(client: TestClient, admin: Headers) -> None:
    # Pasiflestirme oturumlari iptal eder; yeniden aktiflestirmek eski cihazdaki oturumu diriltmez
    created = _create(client, admin, _reporter())
    client.post(
        "/api/v1/auth/login", json={"email": "ogrenci@kampus-a.edu.tr", "password": PASSWORD}
    )
    user_url = f"{URL}/{created['id']}"

    client.patch(user_url, json={"is_active": False}, headers=admin)
    client.patch(user_url, json={"is_active": True}, headers=admin)

    assert client.post("/api/v1/auth/refresh").status_code == 401
