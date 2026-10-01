"""Bildirim olusturma ve gorme (E3-1): numara, ilk olaylar, kapsam (IDOR), filtre."""

import re
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Case, CaseEvent, Location, Organization
from app.models.enums import ActorType, CaseEventType, UserRole
from tests.integration.factories import (
    bearer,
    make_department,
    make_location,
    make_organization,
    make_user,
)

URL = "/api/v1/cases"
DESCRIPTION = "B Blok 2. kat erkek tuvaletinde sabunluklar tamamen boşalmış."
Headers = dict[str, str]


@dataclass
class Campus:
    organization: Organization
    location: Location
    reporter: Headers
    other_reporter: Headers
    manager: Headers


@pytest.fixture
def campus(client: TestClient, db_session: Session) -> Campus:
    organization = make_organization(db_session)
    for email, role in [
        ("ogrenci@kampus-a.edu.tr", UserRole.REPORTER),
        ("baska.ogrenci@kampus-a.edu.tr", UserRole.REPORTER),
        ("mudur@kampus-a.edu.tr", UserRole.MANAGER),
    ]:
        make_user(db_session, email=email, role=role, organization=organization)
    return Campus(
        organization=organization,
        location=make_location(db_session, organization),
        reporter=bearer(client, "ogrenci@kampus-a.edu.tr"),
        other_reporter=bearer(client, "baska.ogrenci@kampus-a.edu.tr"),
        manager=bearer(client, "mudur@kampus-a.edu.tr"),
    )


def _create(
    client: TestClient, campus: Campus, headers: Headers | None = None
) -> dict[str, object]:
    body = {"description": DESCRIPTION, "location_id": campus.location.id}
    response = client.post(URL, json=body, headers=headers or campus.reporter)
    assert response.status_code == 201, response.text
    created: dict[str, object] = response.json()
    return created


def test_new_case_starts_analysis_with_a_case_number(client: TestClient, campus: Campus) -> None:
    created = _create(client, campus)

    assert created["status"] == "ANALYZING"
    assert re.fullmatch(r"CASE-\d{6}", str(created["case_number"]))
    assert created["location"] == {
        "id": campus.location.id,
        "kind": "WC",
        "name": campus.location.name,
        "path": campus.location.path,
    }
    # Tur, birim ve oncelik agent'larin isi; olusturmada bos
    assert created["case_type"] is None
    assert created["department"] is None


def test_title_defaults_to_the_start_of_the_description(client: TestClient, campus: Campus) -> None:
    created = _create(client, campus)

    # Uzun aciklama kelime sinirinda kisaltilir ve sonuna ... konur (tests/unit/test_case_title.py)
    assert DESCRIPTION.startswith(str(created["title"]).removesuffix("…"))
    assert 0 < len(str(created["title"])) <= len(DESCRIPTION)


def test_case_numbers_increase(client: TestClient, campus: Campus) -> None:
    first = _create(client, campus)
    second = _create(client, campus)

    assert str(second["case_number"]) > str(first["case_number"])


def test_creation_writes_the_first_timeline_events(client: TestClient, campus: Campus) -> None:
    created = _create(client, campus)

    events = client.get(f"{URL}/{created['id']}/events", headers=campus.reporter).json()

    assert [(e["event_type"], e["from_status"], e["to_status"]) for e in events] == [
        ("CASE_CREATED", None, "NEW"),
        ("ANALYSIS_STARTED", "NEW", "ANALYZING"),
    ]
    assert events[0]["actor_type"] == "USER"


def test_location_of_another_organization_is_404(
    client: TestClient, db_session: Session, campus: Campus
) -> None:
    foreign = make_location(db_session, make_organization(db_session), code="YABANCI")

    response = client.post(
        URL, json={"description": DESCRIPTION, "location_id": foreign.id}, headers=campus.reporter
    )

    assert response.status_code == 404


def test_inactive_location_is_404(client: TestClient, db_session: Session, campus: Campus) -> None:
    closed = make_location(db_session, campus.organization, code="KAPALI", is_active=False)

    response = client.post(
        URL, json={"description": DESCRIPTION, "location_id": closed.id}, headers=campus.reporter
    )

    assert response.status_code == 404


def test_reporter_cannot_see_someone_elses_case(client: TestClient, campus: Campus) -> None:
    created = _create(client, campus)

    assert client.get(f"{URL}/{created['id']}", headers=campus.other_reporter).status_code == 404
    events = client.get(f"{URL}/{created['id']}/events", headers=campus.other_reporter)
    assert events.status_code == 404


def test_reporter_lists_only_own_cases(client: TestClient, campus: Campus) -> None:
    mine = _create(client, campus)
    _create(client, campus, campus.other_reporter)

    for path in (URL, f"{URL}/mine"):
        body = client.get(path, headers=campus.reporter).json()
        assert [item["id"] for item in body["items"]] == [mine["id"]], path


def test_manager_sees_all_cases_of_own_organization_only(
    client: TestClient, db_session: Session, campus: Campus
) -> None:
    _create(client, campus)
    _create(client, campus, campus.other_reporter)
    stranger = make_user(db_session, email="mudur@kampus-b.edu.tr", role=UserRole.MANAGER)

    assert client.get(URL, headers=campus.manager).json()["total"] == 2
    assert client.get(URL, headers=bearer(client, stranger.email)).json()["total"] == 0


def test_staff_sees_cases_routed_to_their_department(
    client: TestClient, db_session: Session, campus: Campus
) -> None:
    created = _create(client, campus)
    department = make_department(db_session, campus.organization, "SUPPORT_SERVICES")
    case = db_session.get(Case, created["id"])
    assert case is not None
    case.department_id = department.id
    make_user(
        db_session,
        email="temizlik@kampus-a.edu.tr",
        role=UserRole.STAFF,
        organization=campus.organization,
        department_id=department.id,
    )

    staff = bearer(client, "temizlik@kampus-a.edu.tr")

    assert client.get(f"{URL}/{created['id']}", headers=staff).status_code == 200
    assert client.get(URL, headers=staff).json()["total"] == 1


def test_list_filters_by_status(client: TestClient, campus: Campus) -> None:
    _create(client, campus)

    analyzing = client.get(URL, params={"status": "ANALYZING"}, headers=campus.manager).json()
    closed = client.get(URL, params={"status": "CLOSED"}, headers=campus.manager).json()

    assert analyzing["total"] == 1
    assert closed["total"] == 0


def test_newest_case_is_listed_first(client: TestClient, campus: Campus) -> None:
    first = _create(client, campus)
    second = _create(client, campus)

    items = client.get(f"{URL}/mine", headers=campus.reporter).json()["items"]

    assert [item["id"] for item in items] == [second["id"], first["id"]]


def test_login_is_required(client: TestClient) -> None:
    assert client.get(URL).status_code == 401


def test_reporter_timeline_hides_internal_agent_events(
    client: TestClient, db_session: Session, campus: Campus
) -> None:
    # Agent gerekcesi/karar ayrintisi yalniz yetkililere; bildirim yapan sade zaman cizelgesi gorur.
    # "Incelendi" (AI_CLASSIFIED) adimi gorunur ama ayrintisi (metadata) bos doner
    created = _create(client, campus)
    for event_type in (CaseEventType.AI_CLASSIFIED, CaseEventType.VERIFICATION_SCORED):
        db_session.add(
            CaseEvent(
                case_id=created["id"],
                event_type=event_type,
                actor_type=ActorType.AGENT,
                agent_name="classification",
                metadata_json={"confidence": 0.91},
            )
        )
    db_session.flush()

    reporter_view = client.get(f"{URL}/{created['id']}/events", headers=campus.reporter).json()
    manager_view = client.get(f"{URL}/{created['id']}/events", headers=campus.manager).json()

    reporter_types = [e["event_type"] for e in reporter_view]
    assert "AI_CLASSIFIED" in reporter_types
    assert "VERIFICATION_SCORED" not in reporter_types
    assert all(e["metadata"] == {} for e in reporter_view)
    assert manager_view[-1]["metadata"] == {"confidence": 0.91}
