"""Bildirim listesi suzgecleri (docs/API.md "Cases"): arama, oncelik, SLA asimi, sayfalama.

Arama Turkce harfleri ASCII karsiligina indirir: "kutuphane" ile "Kütüphane" eslesir.
"""

from dataclasses import dataclass
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Case, Location, Organization
from app.models.enums import CaseStatus, Priority, UserRole
from tests.integration.conftest import FrozenClock
from tests.integration.factories import bearer, make_location, make_organization, make_user

URL = "/api/v1/cases"
DESCRIPTION = "Koridordaki tavan lambasi yanip sonuyor, bakim gerekiyor."
Headers = dict[str, str]


@dataclass
class Campus:
    session: Session
    organization: Organization
    location: Location
    reporter: Headers
    manager: Headers


@pytest.fixture
def campus(client: TestClient, db_session: Session) -> Campus:
    organization = make_organization(db_session)
    make_user(db_session, email="ogrenci@kampus-a.edu.tr", organization=organization)
    make_user(
        db_session, email="mudur@kampus-a.edu.tr", role=UserRole.MANAGER, organization=organization
    )
    return Campus(
        session=db_session,
        organization=organization,
        location=make_location(db_session, organization),
        reporter=bearer(client, "ogrenci@kampus-a.edu.tr"),
        manager=bearer(client, "mudur@kampus-a.edu.tr"),
    )


def _create(client: TestClient, campus: Campus, location: Location | None = None) -> Case:
    body = {"description": DESCRIPTION, "location_id": (location or campus.location).id}
    response = client.post(URL, json=body, headers=campus.reporter)
    assert response.status_code == 201, response.text
    case = campus.session.get(Case, response.json()["id"])
    assert case is not None
    return case


def _ids(client: TestClient, campus: Campus, **params: object) -> list[int]:
    response = client.get(URL, params=params, headers=campus.manager)
    assert response.status_code == 200, response.text
    return [item["id"] for item in response.json()["items"]]


def test_search_matches_title_ignoring_turkish_case(client: TestClient, campus: Campus) -> None:
    lamp = _create(client, campus)
    lamp.title = "Kırık Işık Ünitesi"
    _create(client, campus).title = "Sabun bitti"
    campus.session.flush()

    for query in ("ışık", "IŞIK", "kirik", "ünİte"):
        assert _ids(client, campus, q=query) == [lamp.id], query


def test_search_matches_case_number_and_location_name(client: TestClient, campus: Campus) -> None:
    library = make_location(campus.session, campus.organization, "KUTUPHANE")
    in_library = _create(client, campus, library)
    other = _create(client, campus)

    assert _ids(client, campus, q="kütüphane tuv") == [in_library.id]
    assert _ids(client, campus, q=other.case_number.lower()) == [other.id]


def test_search_treats_wildcards_as_plain_text(client: TestClient, campus: Campus) -> None:
    _create(client, campus)

    assert _ids(client, campus, q="%") == []
    assert _ids(client, campus, q="_") == []


def test_list_filters_by_priority(client: TestClient, campus: Campus) -> None:
    urgent = _create(client, campus)
    urgent.priority = Priority.CRITICAL
    _create(client, campus).priority = Priority.LOW
    campus.session.flush()

    assert _ids(client, campus, priority="CRITICAL") == [urgent.id]


def test_breached_filter_matches_the_listed_sla_status(
    client: TestClient, campus: Campus, clock: FrozenClock
) -> None:
    now = clock.now()
    overdue = _create(client, campus)
    overdue.due_at = now - timedelta(hours=1)
    _create(client, campus).due_at = now + timedelta(hours=1)
    on_time = _create(client, campus)
    late = _create(client, campus)
    for case, resolved in ((on_time, now - timedelta(hours=3)), (late, now - timedelta(hours=1))):
        case.status = CaseStatus.CLOSED
        case.due_at = now - timedelta(hours=2)
        case.resolved_at = resolved
    _create(client, campus)
    campus.session.flush()

    response = client.get(URL, params={"sla_status": "BREACHED"}, headers=campus.manager).json()

    assert {item["id"] for item in response["items"]} == {overdue.id, late.id}
    assert {item["sla_status"] for item in response["items"]} == {"BREACHED"}
    closed = _ids(client, campus, sla_status="BREACHED", status="CLOSED")
    assert closed == [late.id]


def test_total_counts_filtered_cases_across_pages(client: TestClient, campus: Campus) -> None:
    for _ in range(3):
        _create(client, campus).priority = Priority.HIGH
    _create(client, campus).priority = Priority.LOW
    campus.session.flush()

    params = {"priority": "HIGH", "page_size": 2, "page": 2}
    body = client.get(URL, params=params, headers=campus.manager).json()

    assert body["total"] == 3
    assert len(body["items"]) == 1


def test_unknown_sla_filter_is_rejected(client: TestClient, campus: Campus) -> None:
    response = client.get(URL, params={"sla_status": "AT_RISK"}, headers=campus.manager)

    assert response.status_code == 422
