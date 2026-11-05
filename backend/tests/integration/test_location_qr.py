"""Konum QR kodu: kapiya asilir, okutulunca bildirim formu o konum secili acilir.

QR'in icindeki adres: <uygulama adresi>/report?location=<id>. Form konumu GET /locations/{id} ile
alir (her rol; yalniz kendi kurumunun aktif konumu).
"""

import io

import pytest
import segno
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.enums import UserRole
from app.services.location_qr import report_url
from tests.integration.factories import login_headers

ADMIN_URL = "/api/v1/admin/locations"
URL = "/api/v1/locations"
Headers = dict[str, str]
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> Headers:
    return login_headers(client, db_session, email="admin@kampus-a.edu.tr")


def _create(client: TestClient, headers: Headers, code: str = "B", **extra: object) -> int:
    body = {"kind": "WC", "code": code, "name": f"{code} Blok WC"} | extra
    response = client.post(ADMIN_URL, json=body, headers=headers)
    assert response.status_code == 201, response.text
    location_id: int = response.json()["id"]
    return location_id


def _reporter(client: TestClient, admin: Headers) -> Headers:
    user = {
        "email": "ogrenci@kampus-a.edu.tr",
        "full_name": "Ali Veli",
        "role": "REPORTER",
        "reporter_kind": "STUDENT",
        "password": "ogrenci-parola-1",
    }
    assert client.post("/api/v1/admin/users", json=user, headers=admin).status_code == 201
    login = client.post(
        "/api/v1/auth/login", json={"email": user["email"], "password": user["password"]}
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_svg_qr_points_to_the_report_form_of_that_location(
    client: TestClient, admin: Headers
) -> None:
    location_id = _create(client, admin)

    response = client.get(f"{ADMIN_URL}/{location_id}/qr", headers=admin)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    expected = io.BytesIO()
    target = f"{get_settings().app_url}/report?location={location_id}"
    segno.make(target, error="m").save(expected, kind="svg", scale=10, border=2)
    assert response.content == expected.getvalue()


def test_png_qr_for_printing(client: TestClient, admin: Headers) -> None:
    location_id = _create(client, admin)

    response = client.get(f"{ADMIN_URL}/{location_id}/qr", params={"format": "png"}, headers=admin)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(PNG_MAGIC)


def test_qr_file_name_says_where_it_belongs(client: TestClient, admin: Headers) -> None:
    location_id = _create(client, admin, code="B-2-WC")

    response = client.get(f"{ADMIN_URL}/{location_id}/qr", headers=admin)

    assert 'filename="qr-B-2-WC.svg"' in response.headers["content-disposition"]


def test_qr_of_another_organization_is_404(
    client: TestClient, db_session: Session, admin: Headers
) -> None:
    other = login_headers(client, db_session, email="admin@kampus-b.edu.tr")
    foreign = _create(client, other)

    assert client.get(f"{ADMIN_URL}/{foreign}/qr", headers=admin).status_code == 404


def test_only_admins_print_qr_codes(
    client: TestClient, db_session: Session, admin: Headers
) -> None:
    location_id = _create(client, admin)
    manager = login_headers(
        client, db_session, email="mudur@kampus-a.edu.tr", role=UserRole.MANAGER
    )

    assert client.get(f"{ADMIN_URL}/{location_id}/qr", headers=manager).status_code == 403


def test_report_form_reads_the_scanned_location(client: TestClient, admin: Headers) -> None:
    location_id = _create(client, admin)
    reporter = _reporter(client, admin)

    response = client.get(f"{URL}/{location_id}", headers=reporter)

    assert response.status_code == 200
    body = response.json()
    assert (body["id"], body["name"], body["path"]) == (location_id, "B Blok WC", "B")
    assert "importance_weight" not in body


def test_inactive_or_foreign_location_from_a_qr_is_404(
    client: TestClient, db_session: Session, admin: Headers
) -> None:
    inactive = _create(client, admin, code="OLD")
    patched = client.patch(f"{ADMIN_URL}/{inactive}", json={"is_active": False}, headers=admin)
    assert patched.status_code == 200
    other = login_headers(client, db_session, email="admin@kampus-b.edu.tr")
    foreign = _create(client, other)
    reporter = _reporter(client, admin)

    assert client.get(f"{URL}/{inactive}", headers=reporter).status_code == 404
    assert client.get(f"{URL}/{foreign}", headers=reporter).status_code == 404


@pytest.mark.parametrize(
    ("base", "expected"),
    [
        (
            "https://bitirme-projesi-mu.vercel.app",
            "https://bitirme-projesi-mu.vercel.app/report?location=7",
        ),
        ("http://localhost:3000/", "http://localhost:3000/report?location=7"),
    ],
)
def test_report_url(base: str, expected: str) -> None:
    assert report_url(base, 7) == expected
