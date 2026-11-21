"""Parola yonetimi: kullanici kendi parolasini degistirir, admin sifirlar (docs/API.md "Auth").

Guvenlik: degisiklik diger cihazlardaki oturumlari kapatir; admin'in verdigi parolayla giren
kullanicidan kendi parolasini belirlemesi istenir (must_change_password).
"""

from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.auth import REFRESH_COOKIE_NAME
from app.core.constants import LOGIN_MAX_FAILURES_PER_EMAIL
from app.models import AuditLog
from app.models.enums import UserRole
from tests.integration.factories import DEFAULT_PASSWORD, make_organization, make_user

LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
ME = "/api/v1/auth/me"
CHANGE = "/api/v1/auth/password"
NEW = "yepyeni-parola-42"
EMAIL = "ayse@example.edu.tr"
COOKIE_PATH = "/api/v1/auth"


def _login(client: TestClient, password: str = DEFAULT_PASSWORD) -> Response:
    return client.post(LOGIN, json={"email": EMAIL, "password": password})


def _bearer(response: Response) -> dict[str, str]:
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _change(client: TestClient, headers: dict[str, str], current: str, new: str) -> Response:
    body = {"current_password": current, "new_password": new}
    return client.post(CHANGE, json=body, headers=headers)


def test_user_changes_password_and_other_devices_are_signed_out(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)
    _login(client)
    laptop = client.cookies[REFRESH_COOKIE_NAME]
    client.cookies.clear()
    phone = _bearer(_login(client))

    response = _change(client, phone, DEFAULT_PASSWORD, NEW)

    assert response.status_code == 200
    # Degistiren cihaz yeni token'la devam eder
    assert client.get(ME, headers=_bearer(response)).status_code == 200
    assert client.post(REFRESH).status_code == 200
    # Diger cihaz cikar
    client.cookies.set(REFRESH_COOKIE_NAME, laptop, path=COOKIE_PATH)
    assert client.post(REFRESH).status_code == 401
    client.cookies.clear()
    assert _login(client).status_code == 401
    assert _login(client, NEW).status_code == 200


def test_wrong_current_password_is_refused_without_logging_out(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)
    headers = _bearer(_login(client))

    response = _change(client, headers, "yanlis-parola", NEW)

    # 401 degil: istemci 401'de oturumu kapatir, burada yalniz form hatasi gosterilmeli
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "WRONG_PASSWORD"
    assert client.post(REFRESH).status_code == 200


def test_guessing_the_current_password_is_rate_limited(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)
    headers = _bearer(_login(client))
    for _ in range(LOGIN_MAX_FAILURES_PER_EMAIL):
        assert _change(client, headers, "yanlis-parola", NEW).status_code == 422

    assert _change(client, headers, DEFAULT_PASSWORD, NEW).status_code == 429


def test_new_password_must_differ_and_be_long_enough(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)
    headers = _bearer(_login(client))

    same = _change(client, headers, DEFAULT_PASSWORD, DEFAULT_PASSWORD)
    short = _change(client, headers, DEFAULT_PASSWORD, "kisa")

    assert same.status_code == 422
    assert same.json()["error"]["code"] == "SAME_PASSWORD"
    assert short.status_code == 422


def test_admin_resets_a_password_and_user_must_choose_a_new_one(
    client: TestClient, db_session: Session
) -> None:
    organization = make_organization(db_session)
    make_user(db_session, organization=organization)
    admin = make_user(
        db_session, email="admin@example.edu.tr", role=UserRole.ADMIN, organization=organization
    )
    user_device = _login(client)
    user_cookie = client.cookies[REFRESH_COOKIE_NAME]
    client.cookies.clear()
    admin_headers = _bearer(
        client.post(LOGIN, json={"email": admin.email, "password": DEFAULT_PASSWORD})
    )
    user_id = client.get(ME, headers=_bearer(user_device)).json()["id"]

    reset = client.post(
        f"/api/v1/admin/users/{user_id}/password",
        json={"new_password": "gecici-parola-1"},
        headers=admin_headers,
    )

    assert reset.status_code == 200
    assert reset.json()["must_change_password"] is True
    # Kullanicinin acik oturumu kapanir, eski parola gecmez
    client.cookies.set(REFRESH_COOKIE_NAME, user_cookie, path=COOKIE_PATH)
    assert client.post(REFRESH).status_code == 401
    client.cookies.clear()
    assert _login(client).status_code == 401
    temporary = _bearer(_login(client, "gecici-parola-1"))
    assert client.get(ME, headers=temporary).json()["must_change_password"] is True
    # Kendi parolasini belirleyince bayrak kalkar
    changed = _change(client, temporary, "gecici-parola-1", NEW)
    assert client.get(ME, headers=_bearer(changed)).json()["must_change_password"] is False
    actions = db_session.scalars(select(AuditLog.action).where(AuditLog.entity_id == user_id))
    assert "USER_PASSWORD_RESET" in set(actions)


def test_admin_created_user_must_choose_a_password(client: TestClient, db_session: Session) -> None:
    make_user(db_session, email="admin@example.edu.tr", role=UserRole.ADMIN)
    admin_headers = _bearer(
        client.post(LOGIN, json={"email": "admin@example.edu.tr", "password": DEFAULT_PASSWORD})
    )
    body = {
        "email": "yeni@example.edu.tr",
        "full_name": "Yeni Kullanıcı",
        "role": "ADMIN",
        "password": "gecici-parola-1",
    }

    created = client.post("/api/v1/admin/users", json=body, headers=admin_headers)

    assert created.json()["must_change_password"] is True


def test_admin_cannot_reset_own_password_or_another_organizations_user(
    client: TestClient, db_session: Session
) -> None:
    admin = make_user(db_session, email="admin@example.edu.tr", role=UserRole.ADMIN)
    stranger = make_user(db_session, email="baska@example.edu.tr")
    headers = _bearer(client.post(LOGIN, json={"email": admin.email, "password": DEFAULT_PASSWORD}))
    body = {"new_password": "gecici-parola-1"}

    own = client.post(f"/api/v1/admin/users/{admin.id}/password", json=body, headers=headers)
    other = client.post(f"/api/v1/admin/users/{stranger.id}/password", json=body, headers=headers)

    # Kendi parolasi profilden (mevcut parolayla) degisir
    assert own.status_code == 409
    assert other.status_code == 404


def test_only_admins_reset_passwords(client: TestClient, db_session: Session) -> None:
    organization = make_organization(db_session)
    target = make_user(db_session, organization=organization)
    make_user(
        db_session, email="mudur@example.edu.tr", role=UserRole.MANAGER, organization=organization
    )
    headers = _bearer(
        client.post(LOGIN, json={"email": "mudur@example.edu.tr", "password": DEFAULT_PASSWORD})
    )

    response = client.post(
        f"/api/v1/admin/users/{target.id}/password",
        json={"new_password": "gecici-parola-1"},
        headers=headers,
    )

    assert response.status_code == 403
