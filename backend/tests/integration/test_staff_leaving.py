"""Personel pasif yapilinca, rolu degisince ya da baska birime gecince elindeki acik gorevler
sahipsiz kalmaz: gorev iptal edilir, bildirim mudur kararina (ESCALATED) duser ve mudur haber alir.
"""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Case, Task
from app.models.enums import CaseStatus, TaskStatus, UserRole
from tests.integration.factories import (
    bearer,
    make_department,
    make_location,
    make_organization,
    make_user,
)

Headers = dict[str, str]


@dataclass
class Team:
    session: Session
    headers: dict[str, Headers]
    ids: dict[str, int]
    location_id: int
    department_id: int
    other_department_id: int


@pytest.fixture
def team(client: TestClient, db_session: Session) -> Team:
    organization = make_organization(db_session)
    support = make_department(db_session, organization, "SUPPORT_SERVICES")
    other = make_department(db_session, organization, "MAINTENANCE")
    people = {
        "ogrenci": (UserRole.REPORTER, None),
        "temizlik": (UserRole.STAFF, support.id),
        "temizlik2": (UserRole.STAFF, support.id),
        "mudur": (UserRole.MANAGER, support.id),
        "admin": (UserRole.ADMIN, None),
    }
    ids = {
        name: make_user(
            db_session,
            email=f"{name}@kampus.edu.tr",
            role=role,
            organization=organization,
            department_id=department_id,
        ).id
        for name, (role, department_id) in people.items()
    }
    headers = {name: bearer(client, f"{name}@kampus.edu.tr") for name in people}
    location_id = make_location(db_session, organization).id
    return Team(db_session, headers, ids, location_id, support.id, other.id)


def _working_case(client: TestClient, team: Team, staff: str | None) -> int:
    """Bildirim acilir ve personele (None ise birim havuzuna) atanir; personel ise baslar."""
    body = {"description": "Tuvalette sabunluk tamamen boş.", "location_id": team.location_id}
    case_id: int = client.post("/api/v1/cases", json=body, headers=team.headers["ogrenci"]).json()[
        "id"
    ]
    assignment: dict[str, object] = {"department_id": team.department_id}
    if staff is not None:
        assignment["user_id"] = team.ids[staff]
    url = f"/api/v1/cases/{case_id}/assign"
    assert client.post(url, json=assignment, headers=team.headers["mudur"]).status_code == 200
    if staff is not None:
        [task] = client.get("/api/v1/tasks/mine", headers=team.headers[staff]).json()["items"]
        for action in ("accept", "start"):
            started = client.post(
                f"/api/v1/tasks/{task['id']}/{action}", json={}, headers=team.headers[staff]
            )
            assert started.status_code == 200
    return case_id


def _update(client: TestClient, team: Team, user: str, body: dict[str, object]) -> None:
    url = f"/api/v1/admin/users/{team.ids[user]}"
    response = client.patch(url, json=body, headers=team.headers["admin"])
    assert response.status_code == 200, response.text


def _case(team: Team, case_id: int) -> Case:
    case = team.session.get(Case, case_id)
    assert case is not None
    team.session.refresh(case)
    return case


def _tasks(team: Team, case_id: int) -> list[TaskStatus]:
    return list(team.session.scalars(select(Task.status).where(Task.case_id == case_id)))


@pytest.mark.parametrize(
    "change",
    [{"is_active": False}, {"department_id": "other"}, {"role": "MANAGER"}],
    ids=["deactivated", "moved", "promoted"],
)
def test_open_tasks_of_staff_who_leave_go_back_to_the_manager(
    client: TestClient, team: Team, change: dict[str, object]
) -> None:
    in_progress = _working_case(client, team, "temizlik")
    someone_else = _working_case(client, team, "temizlik2")
    body = {k: team.other_department_id if v == "other" else v for k, v in change.items()}

    _update(client, team, "temizlik", body)

    case = _case(team, in_progress)
    assert case.status is CaseStatus.ESCALATED
    assert case.assigned_staff_id is None
    assert _tasks(team, in_progress) == [TaskStatus.CANCELLED]
    # Baska personelin isine dokunulmaz
    assert _case(team, someone_else).status is CaseStatus.IN_PROGRESS
    queue = client.get("/api/v1/manager/review-queue", headers=team.headers["mudur"]).json()
    assert in_progress in [row["case"]["id"] for row in queue["items"]]
    alerts = client.get("/api/v1/notifications", headers=team.headers["mudur"]).json()["items"]
    assert [n["case_id"] for n in alerts if n["event_type"] == "ESCALATED"] == [in_progress]


def test_other_changes_and_pool_tasks_keep_the_work(client: TestClient, team: Team) -> None:
    mine = _working_case(client, team, "temizlik")
    pool = _working_case(client, team, None)

    _update(client, team, "temizlik", {"full_name": "Ayşe Temiz"})
    _update(client, team, "temizlik2", {"is_active": False})

    assert _case(team, mine).status is CaseStatus.IN_PROGRESS
    assert _case(team, pool).status is CaseStatus.ASSIGNED
    assert _tasks(team, pool) == [TaskStatus.PENDING]


def test_timeline_explains_why_the_task_was_taken_back(client: TestClient, team: Team) -> None:
    case_id = _working_case(client, team, "temizlik")

    _update(client, team, "temizlik", {"is_active": False})

    events = client.get(f"/api/v1/cases/{case_id}/events", headers=team.headers["mudur"]).json()
    escalated = [e for e in events if e["event_type"] == "ESCALATED"]
    assert escalated[-1]["metadata"]["reason"] == "ASSIGNEE_UNAVAILABLE"
    assert escalated[-1]["metadata"]["previous_assignee_id"] == team.ids["temizlik"]


def test_closing_a_department_sends_its_open_work_back_to_the_managers(
    client: TestClient, team: Team
) -> None:
    in_progress = _working_case(client, team, "temizlik")
    pool = _working_case(client, team, None)
    url = f"/api/v1/admin/departments/{team.department_id}"

    closed = client.patch(url, json={"is_active": False}, headers=team.headers["admin"])

    assert closed.status_code == 200, closed.text
    for case_id in (in_progress, pool):
        case = _case(team, case_id)
        assert case.status is CaseStatus.ESCALATED
        # Pasif birim yeniden atamada secilemez; mudur yeni birimi secer
        assert (case.department_id, case.assigned_staff_id) == (None, None)
        assert _tasks(team, case_id) == [TaskStatus.CANCELLED]
    alerts = client.get("/api/v1/notifications", headers=team.headers["mudur"]).json()["items"]
    escalated = {n["case_id"] for n in alerts if n["event_type"] == "ESCALATED"}
    assert escalated == {in_progress, pool}


def test_renaming_a_department_keeps_its_work(client: TestClient, team: Team) -> None:
    case_id = _working_case(client, team, "temizlik")
    url = f"/api/v1/admin/departments/{team.department_id}"

    renamed = client.patch(url, json={"name": "Destek"}, headers=team.headers["admin"])

    assert renamed.status_code == 200, renamed.text
    assert _case(team, case_id).status is CaseStatus.IN_PROGRESS
