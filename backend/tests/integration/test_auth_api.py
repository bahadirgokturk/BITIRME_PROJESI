"""Giris sistemi: mutlu yol + saldiri senaryolari (docs/TESTING.md "Guvenlik")."""

from datetime import timedelta

from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy.orm import Session

from app.api.v1.auth import REFRESH_COOKIE_NAME
from app.core.constants import REFRESH_REUSE_GRACE_SECONDS
from tests.integration.conftest import FrozenClock
from tests.integration.factories import DEFAULT_PASSWORD, make_user

LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"


def _login(
    client: TestClient, email: str = "ayse@example.edu.tr", password: str = DEFAULT_PASSWORD
) -> Response:
    return client.post(LOGIN, json={"email": email, "password": password})


def _bearer(response: Response) -> dict[str, str]:
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


# --- Login ---


def test_login_returns_access_token_and_sets_hardened_refresh_cookie(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)

    response = _login(client)

    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["expires_in"] == 30 * 60
    cookie_header = response.headers["set-cookie"].lower()
    assert f"{REFRESH_COOKIE_NAME}=" in cookie_header
    assert "httponly" in cookie_header
    assert "samesite=strict" in cookie_header
    assert "path=/api/v1/auth" in cookie_header
    # Refresh token yanit govdesinde yok; JavaScript onu hic goremez
    assert "refresh" not in response.text


def test_login_records_last_login_time(
    client: TestClient, db_session: Session, clock: FrozenClock
) -> None:
    user = make_user(db_session)

    _login(client)

    db_session.refresh(user)
    assert user.last_login_at == clock.now()


def test_login_email_is_case_insensitive(client: TestClient, db_session: Session) -> None:
    make_user(db_session)

    assert _login(client, email="Ayse@Example.EDU.tr").status_code == 200


def test_wrong_password_and_unknown_email_look_identical(
    client: TestClient, db_session: Session
) -> None:
    # Farkli cevap verseydik saldirgan hangi e-postalarin kayitli oldugunu ogrenirdi
    make_user(db_session)

    wrong_password = _login(client, password="yanlis-parola")
    unknown_email = _login(client, email="kimse@example.edu.tr")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert "set-cookie" not in wrong_password.headers


def test_inactive_user_cannot_log_in(client: TestClient, db_session: Session) -> None:
    make_user(db_session, is_active=False)

    response = _login(client)

    assert response.status_code == 401
    assert response.json() == _login(client, email="kimse@example.edu.tr").json()


# --- /auth/me ---


def test_me_returns_the_signed_in_user(client: TestClient, db_session: Session) -> None:
    make_user(db_session)

    response = client.get(ME, headers=_bearer(_login(client)))

    assert response.status_code == 200
    assert response.json()["email"] == "ayse@example.edu.tr"
    assert "password_hash" not in response.json()


def test_me_without_token_is_401(client: TestClient) -> None:
    response = client.get(ME)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_me_with_garbage_token_is_401(client: TestClient) -> None:
    assert client.get(ME, headers={"Authorization": "Bearer bozuk"}).status_code == 401


def test_me_with_expired_access_token_is_401(
    client: TestClient, db_session: Session, clock: FrozenClock
) -> None:
    make_user(db_session)
    headers = _bearer(_login(client))

    clock.advance(timedelta(minutes=31))

    assert client.get(ME, headers=headers).status_code == 401


def test_deactivated_user_is_locked_out_even_with_valid_token(
    client: TestClient, db_session: Session
) -> None:
    user = make_user(db_session)
    headers = _bearer(_login(client))

    user.is_active = False
    db_session.flush()

    assert client.get(ME, headers=headers).status_code == 401


# --- Refresh: rotasyon + calinma tespiti ---


def test_refresh_rotates_the_refresh_token(client: TestClient, db_session: Session) -> None:
    make_user(db_session)
    _login(client)
    first_cookie = client.cookies[REFRESH_COOKIE_NAME]

    response = client.post(REFRESH)

    assert response.status_code == 200
    assert client.get(ME, headers=_bearer(response)).status_code == 200
    assert client.cookies[REFRESH_COOKIE_NAME] != first_cookie


def test_reusing_an_old_refresh_token_revokes_every_session(
    client: TestClient, db_session: Session, clock: FrozenClock
) -> None:
    # Senaryo: saldirgan eski (calinmis) refresh token'i kullanir. Rotasyondan sonra eski token
    # tekrar gelirse bu calinma belirtisidir: kullanicinin tum oturumlari kapatilir.
    make_user(db_session)
    _login(client)
    stolen = client.cookies[REFRESH_COOKIE_NAME]
    client.post(REFRESH)
    legit_new = client.cookies[REFRESH_COOKIE_NAME]
    # Es zamanli istek toleransi gectikten sonra eski token gelirse calinma sayilir
    clock.advance(timedelta(seconds=REFRESH_REUSE_GRACE_SECONDS + 1))

    client.cookies.set(REFRESH_COOKIE_NAME, stolen, path="/api/v1/auth")
    assert client.post(REFRESH).status_code == 401

    client.cookies.set(REFRESH_COOKIE_NAME, legit_new, path="/api/v1/auth")
    assert client.post(REFRESH).status_code == 401


def test_two_tabs_refreshing_at_once_do_not_log_the_user_out(
    client: TestClient, db_session: Session, clock: FrozenClock
) -> None:
    # Iki sekme ayni refresh token'la neredeyse ayni anda yeniler: biri kazanir, digeri 401 alir;
    # ama bu calinma sayilmaz, kazanan sekmenin yeni oturumu acik kalir
    make_user(db_session)
    _login(client)
    shared = client.cookies[REFRESH_COOKIE_NAME]
    winner = client.post(REFRESH)
    winner_cookie = client.cookies[REFRESH_COOKIE_NAME]

    # Ikinci sekmenin istegi 1 sn sonra ulasir (tolerans icinde)
    clock.advance(timedelta(seconds=1))
    client.cookies.set(REFRESH_COOKIE_NAME, shared, path="/api/v1/auth")
    assert client.post(REFRESH).status_code == 401

    client.cookies.set(REFRESH_COOKIE_NAME, winner_cookie, path="/api/v1/auth")
    assert client.post(REFRESH).status_code == 200
    assert client.get(ME, headers=_bearer(winner)).status_code == 200


def test_refresh_without_cookie_is_401(client: TestClient) -> None:
    assert client.post(REFRESH).status_code == 401


def test_expired_refresh_token_is_401(
    client: TestClient, db_session: Session, clock: FrozenClock
) -> None:
    make_user(db_session)
    _login(client)

    clock.advance(timedelta(days=7, seconds=1))

    assert client.post(REFRESH).status_code == 401


def test_refresh_for_deactivated_user_is_401(client: TestClient, db_session: Session) -> None:
    user = make_user(db_session)
    _login(client)

    user.is_active = False
    db_session.flush()

    assert client.post(REFRESH).status_code == 401


# --- Logout ---


def test_logout_revokes_refresh_token_and_clears_cookie(
    client: TestClient, db_session: Session
) -> None:
    make_user(db_session)
    _login(client)
    token = client.cookies[REFRESH_COOKIE_NAME]

    response = client.post(LOGOUT)

    assert response.status_code == 204
    assert f'{REFRESH_COOKIE_NAME}=""' in response.headers["set-cookie"]
    # Cookie silinse bile token DB'de iptal edildigi icin elde tutulan kopya ise yaramaz
    client.cookies.set(REFRESH_COOKIE_NAME, token, path="/api/v1/auth")
    assert client.post(REFRESH).status_code == 401


def test_logout_without_cookie_is_harmless(client: TestClient) -> None:
    assert client.post(LOGOUT).status_code == 204
