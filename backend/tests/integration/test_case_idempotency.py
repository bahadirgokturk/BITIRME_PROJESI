"""Idempotency-Key (POST /cases): baglanti kopunca tekrar gonderilen bildirim ikinci kez olusmaz."""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Case, CaseEvent, Location
from app.models.enums import CaseEventType, UserRole
from app.repositories import case_repository
from tests.integration.factories import bearer, make_location, make_organization, make_user

URL = "/api/v1/cases"
DESCRIPTION = "B Blok 2. kat erkek tuvaletinde sabunluklar tamamen boşalmış."
KEY = "3f1c9a52-7d4e-4b8a-9c11-0a2b3c4d5e6f"
Headers = dict[str, str]


@dataclass
class Campus:
    location: Location
    reporter: Headers
    other_reporter: Headers


@pytest.fixture
def campus(client: TestClient, db_session: Session) -> Campus:
    organization = make_organization(db_session)
    for email in ("ogrenci@kampus-a.edu.tr", "baska.ogrenci@kampus-a.edu.tr"):
        make_user(db_session, email=email, role=UserRole.REPORTER, organization=organization)
    return Campus(
        location=make_location(db_session, organization),
        reporter=bearer(client, "ogrenci@kampus-a.edu.tr"),
        other_reporter=bearer(client, "baska.ogrenci@kampus-a.edu.tr"),
    )


def _post(
    client: TestClient, headers: Headers, campus: Campus, key: str | None = KEY
) -> tuple[int, dict[str, object], Headers]:
    extra = {"Idempotency-Key": key} if key is not None else {}
    body = {"description": DESCRIPTION, "location_id": campus.location.id}
    response = client.post(URL, json=body, headers={**headers, **extra})
    return response.status_code, response.json(), dict(response.headers)


def _case_count(db_session: Session) -> int:
    return db_session.scalar(select(func.count()).select_from(Case)) or 0


def test_same_key_returns_the_first_case(
    client: TestClient, db_session: Session, campus: Campus
) -> None:
    first_status, first, first_headers = _post(client, campus.reporter, campus)
    second_status, second, second_headers = _post(client, campus.reporter, campus)
    assert (first_status, second_status) == (201, 201)
    assert second["id"] == first["id"]
    assert "idempotent-replayed" not in first_headers
    assert second_headers["idempotent-replayed"] == "true"
    assert _case_count(db_session) == 1


def test_replay_writes_no_second_creation_event(
    client: TestClient, db_session: Session, campus: Campus
) -> None:
    _post(client, campus.reporter, campus)
    _post(client, campus.reporter, campus)
    created = db_session.scalar(
        select(func.count())
        .select_from(CaseEvent)
        .where(CaseEvent.event_type == CaseEventType.CASE_CREATED)
    )
    assert created == 1


def test_different_keys_create_separate_cases(
    client: TestClient, db_session: Session, campus: Campus
) -> None:
    _post(client, campus.reporter, campus, key="anahtar-1")
    _post(client, campus.reporter, campus, key="anahtar-2")
    assert _case_count(db_session) == 2


def test_without_a_key_every_request_creates_a_case(
    client: TestClient, db_session: Session, campus: Campus
) -> None:
    _post(client, campus.reporter, campus, key=None)
    _post(client, campus.reporter, campus, key=None)
    assert _case_count(db_session) == 2


def test_key_is_scoped_to_the_reporter(
    client: TestClient, db_session: Session, campus: Campus
) -> None:
    _, first, _ = _post(client, campus.reporter, campus)
    status, other, _ = _post(client, campus.other_reporter, campus)
    assert status == 201
    assert other["id"] != first["id"]
    assert _case_count(db_session) == 2


def test_same_key_with_a_different_report_is_409(client: TestClient, campus: Campus) -> None:
    _post(client, campus.reporter, campus)
    other = "Başka bir sorun: projeksiyon açılmıyor."
    body = {"description": other, "location_id": campus.location.id}
    response = client.post(URL, json=body, headers={**campus.reporter, "Idempotency-Key": KEY})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"


@pytest.mark.parametrize("key", ["", "x" * 101])
def test_invalid_key_is_422(client: TestClient, campus: Campus, key: str) -> None:
    status, _, _ = _post(client, campus.reporter, campus, key=key)
    assert status == 422


def test_concurrent_duplicate_falls_back_to_the_first_case(
    client: TestClient, db_session: Session, campus: Campus, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Ikinci istek ilk kayit yazilmadan once bakti: kisitlamaya takilir, ilk bildirim doner."""
    _, first, _ = _post(client, campus.reporter, campus)
    real_find = case_repository.find_by_idempotency_key
    calls = iter([None])
    monkeypatch.setattr(
        case_repository,
        "find_by_idempotency_key",
        lambda *args: next(calls, real_find(*args)),
    )
    status, second, headers = _post(client, campus.reporter, campus)
    assert status == 201
    assert second["id"] == first["id"]
    assert headers["idempotent-replayed"] == "true"
    assert _case_count(db_session) == 1
