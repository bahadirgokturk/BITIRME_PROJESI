"""Liste araclari (docs/API.md): coklu oncelik filtresi ve en yeni / en eski siralama.

GET /cases, GET /cases/mine ve GET /tasks/mine ayni secenekleri alir. Gorev listesinde siralama
verilmezse en acil (SLA hedefi en yakin) once gelir.
"""

from dataclasses import dataclass
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Case
from app.models.enums import CaseStatus, Priority, UserRole
from tests.integration.conftest import FrozenClock
from tests.integration.factories import (
    bearer,
    make_department,
    make_location,
    make_organization,
    make_user,
)

Headers = dict[str, str]
DESCRIPTION = "Koridordaki tavan lambasi yanip sonuyor, bakim gerekiyor."


@dataclass
class Campus:
    reporter: Headers
    staff: Headers
    manager: Headers
    # Acilis sirasina gore: eski -> yeni
    cases: list[Case]


@pytest.fixture
def campus(client: TestClient, db_session: Session, clock: FrozenClock) -> Campus:
    organization = make_organization(db_session)
    support = make_department(db_session, organization, "SUPPORT_SERVICES")
    location = make_location(db_session, organization)
    people = {
        "ogrenci": (UserRole.REPORTER, None),
        "temizlik": (UserRole.STAFF, support.id),
        "mudur": (UserRole.MANAGER, support.id),
    }
    ids = {
        name: make_user(
            db_session,
            email=f"{name}@kampus-a.edu.tr",
            role=role,
            organization=organization,
            department_id=department_id,
        ).id
        for name, (role, department_id) in people.items()
    }
    headers = {name: bearer(client, f"{name}@kampus-a.edu.tr") for name in people}
    cases = []
    # Oncelik ve SLA sirasi acilis sirasindan farkli: siralamanin neye gore oldugu belli olsun
    plan = [
        (Priority.LOW, timedelta(hours=5)),
        (Priority.HIGH, timedelta(hours=1)),
        (Priority.MEDIUM, timedelta(hours=9)),
    ]
    for minutes, (priority, due_in) in enumerate(plan):
        body = {"description": DESCRIPTION, "location_id": location.id}
        created = client.post("/api/v1/cases", json=body, headers=headers["ogrenci"]).json()
        case = db_session.get(Case, created["id"])
        assert case is not None
        assign = {"department_id": support.id, "user_id": ids["temizlik"]}
        response = client.post(
            f"/api/v1/cases/{case.id}/assign", json=assign, headers=headers["mudur"]
        )
        assert response.status_code == 200, response.text
        case.priority = priority
        case.due_at = clock.now() + due_in
        # Saat ilerletilmez (oturum anahtarlari dolar); acilis zamani dogrudan ayrilir
        case.created_at = clock.now() + timedelta(minutes=minutes)
        cases.append(case)
    db_session.flush()
    return Campus(headers["ogrenci"], headers["temizlik"], headers["mudur"], cases)


def _case_ids(client: TestClient, path: str, headers: Headers, **params: object) -> list[int]:
    response = client.get(f"/api/v1/{path}", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return [item["id"] for item in response.json()["items"]]


def _task_case_ids(client: TestClient, headers: Headers, **params: object) -> list[int]:
    response = client.get("/api/v1/tasks/mine", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return [item["case_id"] for item in response.json()["items"]]


@pytest.mark.parametrize("path", ["cases", "cases/mine"])
def test_case_lists_take_several_priorities(client: TestClient, campus: Campus, path: str) -> None:
    low, high, _ = campus.cases
    headers = campus.manager if path == "cases" else campus.reporter

    found = _case_ids(client, path, headers, priority=["LOW", "HIGH"])

    assert found == [high.id, low.id]


@pytest.mark.parametrize("path", ["cases", "cases/mine"])
def test_case_lists_sort_newest_or_oldest_first(
    client: TestClient, campus: Campus, path: str
) -> None:
    headers = campus.manager if path == "cases" else campus.reporter
    opened = [case.id for case in campus.cases]

    assert _case_ids(client, path, headers) == opened[::-1]
    assert _case_ids(client, path, headers, order="newest") == opened[::-1]
    assert _case_ids(client, path, headers, order="oldest") == opened


def test_my_cases_filter_by_status(client: TestClient, db_session: Session, campus: Campus) -> None:
    closed = campus.cases[0]
    closed.status = CaseStatus.CLOSED
    db_session.flush()

    found = _case_ids(client, "cases/mine", campus.reporter, status=["CLOSED"])

    assert found == [closed.id]


def test_tasks_default_to_the_most_urgent_first(client: TestClient, campus: Campus) -> None:
    low, high, medium = campus.cases

    assert _task_case_ids(client, campus.staff) == [high.id, low.id, medium.id]


def test_tasks_sort_by_opening_time_when_asked(client: TestClient, campus: Campus) -> None:
    opened = [case.id for case in campus.cases]

    assert _task_case_ids(client, campus.staff, order="newest") == opened[::-1]
    assert _task_case_ids(client, campus.staff, order="oldest") == opened


def test_tasks_filter_by_priority(client: TestClient, campus: Campus) -> None:
    _, high, medium = campus.cases

    found = _task_case_ids(client, campus.staff, priority=["HIGH", "MEDIUM"])

    assert found == [high.id, medium.id]


def test_unknown_order_is_rejected(client: TestClient, campus: Campus) -> None:
    for path in ("cases", "cases/mine", "tasks/mine"):
        response = client.get(f"/api/v1/{path}", params={"order": "random"}, headers=campus.staff)
        assert response.status_code == 422, path
