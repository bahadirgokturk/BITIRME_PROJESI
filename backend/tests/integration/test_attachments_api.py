"""Bildirime fotograf ekleme ve indirme (E3-3): yetki (IDOR), tur/boyut, guvenli basliklar."""

import os
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.core.constants import MAX_ATTACHMENTS_PER_CASE, MAX_UPLOAD_MB_DEFAULT
from app.models import Case, Organization
from app.models.enums import UserRole
from tests.integration.factories import (
    bearer,
    make_department,
    make_location,
    make_organization,
    make_user,
)
from tests.media_samples import mp4

Headers = dict[str, str]


def _png() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (6, 6), "blue").save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def case_id(client: TestClient, db_session: Session) -> int:
    organization = make_organization(db_session)
    for email, role in [
        ("ogrenci@kampus-a.edu.tr", UserRole.REPORTER),
        ("baska@kampus-a.edu.tr", UserRole.REPORTER),
        ("admin@kampus-a.edu.tr", UserRole.ADMIN),
        ("mudur@kampus-a.edu.tr", UserRole.MANAGER),
    ]:
        make_user(db_session, email=email, role=role, organization=organization)
    location = make_location(db_session, organization)
    body = {"description": "Tuvalette sabunluk tamamen boş.", "location_id": location.id}
    response = client.post("/api/v1/cases", json=body, headers=_as(client, "ogrenci"))
    assert response.status_code == 201, response.text
    created: int = response.json()["id"]
    return created


def _as(client: TestClient, name: str) -> Headers:
    return bearer(client, f"{name}@kampus-a.edu.tr")


def _upload(
    client: TestClient, case_id: int, headers: Headers, content: bytes | None = None
) -> tuple[int, dict[str, object]]:
    files = {"file": ("sabunluk.png", content if content is not None else _png(), "image/png")}
    response = client.post(f"/api/v1/cases/{case_id}/attachments", files=files, headers=headers)
    return response.status_code, response.json()


def test_reporter_uploads_and_downloads_a_photo(client: TestClient, case_id: int) -> None:
    reporter = _as(client, "ogrenci")
    status, created = _upload(client, case_id, reporter)

    listing = client.get(f"/api/v1/cases/{case_id}/attachments", headers=reporter).json()
    download = client.get(f"/api/v1/attachments/{created['id']}", headers=reporter)

    assert status == 201
    assert created["kind"] == "REPORT"
    assert created["mime_type"] == "image/png"
    assert [item["id"] for item in listing] == [created["id"]]
    assert download.status_code == 200
    assert download.headers["content-type"] == "image/png"
    assert download.headers["x-content-type-options"] == "nosniff"
    assert Image.open(BytesIO(download.content)).format == "PNG"


def test_other_reporter_cannot_touch_the_photos(client: TestClient, case_id: int) -> None:
    _, created = _upload(client, case_id, _as(client, "ogrenci"))
    stranger = _as(client, "baska")

    assert _upload(client, case_id, stranger)[0] == 404
    assert client.get(f"/api/v1/cases/{case_id}/attachments", headers=stranger).status_code == 404
    assert client.get(f"/api/v1/attachments/{created['id']}", headers=stranger).status_code == 404


def test_manager_can_view_but_admin_cannot_upload(client: TestClient, case_id: int) -> None:
    # docs/WORKFLOW.md bolum 4: admin operasyona karismaz (gorev ayriligi)
    _, created = _upload(client, case_id, _as(client, "ogrenci"))

    manager_view = client.get(f"/api/v1/attachments/{created['id']}", headers=_as(client, "mudur"))

    assert manager_view.status_code == 200
    assert _upload(client, case_id, _as(client, "admin"))[0] == 403


def test_non_image_is_415(client: TestClient, case_id: int) -> None:
    status, body = _upload(client, case_id, _as(client, "ogrenci"), b"%PDF-1.7 sahte")

    assert status == 415
    assert body["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_file_name_is_sanitized(client: TestClient, case_id: int) -> None:
    files = {"file": ("../../etc/passwd.png", _png(), "image/png")}

    response = client.post(
        f"/api/v1/cases/{case_id}/attachments", files=files, headers=_as(client, "ogrenci")
    )

    assert response.json()["original_name"] == "passwd.png"


def test_attachment_count_is_limited(client: TestClient, case_id: int) -> None:
    reporter = _as(client, "ogrenci")
    for _ in range(MAX_ATTACHMENTS_PER_CASE):
        assert _upload(client, case_id, reporter)[0] == 201

    status, body = _upload(client, case_id, reporter)

    assert status == 409
    assert body["error"]["code"] == "CONFLICT"


def test_staff_evidence_has_its_own_limit(
    client: TestClient, db_session: Session, case_id: int
) -> None:
    # Bildirenin 5 fotografi personelin kanit fotografini engellemez (ayri sinir)
    reporter = _as(client, "ogrenci")
    for _ in range(MAX_ATTACHMENTS_PER_CASE):
        assert _upload(client, case_id, reporter)[0] == 201
    staff = _assigned_staff(client, db_session, case_id)

    for _ in range(MAX_ATTACHMENTS_PER_CASE):
        status, body = _upload(client, case_id, staff)
        assert status == 201
        assert body["kind"] == "EVIDENCE"
    status, _ = _upload(client, case_id, staff)

    assert status == 409


def test_phone_sized_photo_is_accepted(client: TestClient, case_id: int) -> None:
    # Guncel telefon fotografi 4-8 MB: 5 MB siniri dar geliyordu
    noisy = Image.frombytes("RGB", (1600, 1600), os.urandom(1600 * 1600 * 3))
    buffer = BytesIO()
    noisy.save(buffer, format="PNG")
    assert 6 * 1024 * 1024 < len(buffer.getvalue()) < MAX_UPLOAD_MB_DEFAULT * 1024 * 1024

    status, _ = _upload(client, case_id, _as(client, "ogrenci"), buffer.getvalue())

    assert status == 201


def _assigned_staff(client: TestClient, db_session: Session, case_id: int) -> Headers:
    case = db_session.get(Case, case_id)
    assert case is not None
    organization = db_session.get(Organization, case.organization_id)
    assert organization is not None
    department = make_department(db_session, organization, "SUPPORT_SERVICES")
    make_user(
        db_session,
        email="temizlik@kampus-a.edu.tr",
        role=UserRole.STAFF,
        organization=organization,
        department_id=department.id,
    )
    assigned = client.post(
        f"/api/v1/cases/{case_id}/assign",
        json={"department_id": department.id},
        headers=_as(client, "mudur"),
    )
    assert assigned.status_code == 200, assigned.text
    return _as(client, "temizlik")


def test_unknown_attachment_is_404(client: TestClient, case_id: int) -> None:
    assert (
        client.get("/api/v1/attachments/999999", headers=_as(client, "ogrenci")).status_code == 404
    )


def test_reporter_uploads_a_short_video(client: TestClient, case_id: int) -> None:
    reporter = _as(client, "ogrenci")
    files = {"file": ("kaçak.mp4", mp4(seconds=20), "video/mp4")}

    response = client.post(f"/api/v1/cases/{case_id}/attachments", files=files, headers=reporter)
    download = client.get(f"/api/v1/attachments/{response.json()['id']}", headers=reporter)

    assert response.status_code == 201
    assert response.json()["mime_type"] == "video/mp4"
    assert download.headers["content-type"] == "video/mp4"


def test_long_video_is_422(client: TestClient, case_id: int) -> None:
    files = {"file": ("uzun.mp4", mp4(seconds=90), "video/mp4")}

    response = client.post(
        f"/api/v1/cases/{case_id}/attachments", files=files, headers=_as(client, "ogrenci")
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VIDEO_TOO_LONG"
