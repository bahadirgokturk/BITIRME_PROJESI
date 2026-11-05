"""Gorevler (E4-1): manager atamasi, personel akisi ve bildirimle senkronizasyon (WORKFLOW.md)."""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Department
from app.models.enums import UserRole
from tests.integration.factories import (
    bearer,
    make_department,
    make_location,
    make_organization,
    make_user,
)

Headers = dict[str, str]
Body = dict[str, object]


@dataclass
class World:
    case_id: int
    support: Department
    maintenance: Department
    headers: dict[str, Headers]
    user_ids: dict[str, int]

    def __getitem__(self, name: str) -> Headers:
        return self.headers[name]


@pytest.fixture
def world(client: TestClient, db_session: Session) -> World:
    organization = make_organization(db_session)
    support = make_department(db_session, organization, "SUPPORT_SERVICES")
    maintenance = make_department(db_session, organization, "MAINTENANCE")
    people = {
        "ogrenci": (UserRole.REPORTER, None),
        "temizlik": (UserRole.STAFF, support.id),
        "temizlik2": (UserRole.STAFF, support.id),
        "teknisyen": (UserRole.STAFF, maintenance.id),
        "mudur": (UserRole.MANAGER, support.id),
        "admin": (UserRole.ADMIN, None),
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
    body = {"description": "Tuvalette sabunluk tamamen boş.", "location_id": 0}
    body["location_id"] = make_location(db_session, organization).id
    created = client.post("/api/v1/cases", json=body, headers=headers["ogrenci"]).json()
    return World(created["id"], support, maintenance, headers, ids)


def _assign(client: TestClient, world: World, headers: Headers, **body: object) -> tuple[int, Body]:
    payload = {"department_id": world.support.id} | body
    response = client.post(f"/api/v1/cases/{world.case_id}/assign", json=payload, headers=headers)
    return response.status_code, response.json()


def _mine(client: TestClient, headers: Headers) -> list[Body]:
    items: list[Body] = client.get("/api/v1/tasks/mine", headers=headers).json()["items"]
    return items


def _act(client: TestClient, headers: Headers, task_id: object, action: str, **body: object) -> int:
    url = f"/api/v1/tasks/{task_id}/{action}"
    return client.post(url, json=body or None, headers=headers).status_code


def _case(client: TestClient, world: World) -> Body:
    case: Body = client.get(f"/api/v1/cases/{world.case_id}", headers=world["mudur"]).json()
    return case


def _events(client: TestClient, world: World) -> list[str]:
    events = client.get(f"/api/v1/cases/{world.case_id}/events", headers=world["mudur"]).json()
    return [e["event_type"] for e in events]


# --- Atama ------------------------------------------------------------------------------


def test_manager_assigns_an_unanalyzed_case(client: TestClient, world: World) -> None:
    status, case = _assign(client, world, world["mudur"], user_id=world.user_ids["temizlik"])

    assert status == 200
    assert case["status"] == "ASSIGNED"
    assert case["department"]["code"] == "SUPPORT_SERVICES"
    # Agent'lar gelmeden (FAZ 5) manager atamasi elle siniflandirma sayilir
    assert _events(client, world)[-2:] == ["ROUTED", "TASK_CREATED"]
    [task] = _mine(client, world["temizlik"])
    assert (task["status"], task["case_id"]) == ("PENDING", world.case_id)


@pytest.mark.parametrize("who", ["temizlik", "admin", "ogrenci"])
def test_only_managers_assign(client: TestClient, world: World, who: str) -> None:
    assert _assign(client, world, world[who])[0] == 403


def test_assignee_must_work_in_the_department(client: TestClient, world: World) -> None:
    status, body = _assign(client, world, world["mudur"], user_id=world.user_ids["teknisyen"])

    assert status == 422
    assert body["error"]["code"] == "INVALID_ASSIGNEE"


def test_department_of_another_organization_is_404(
    client: TestClient, db_session: Session, world: World
) -> None:
    foreign = make_department(db_session, make_organization(db_session), "YABANCI")

    assert _assign(client, world, world["mudur"], department_id=foreign.id)[0] == 404


def test_reassignment_cancels_the_previous_task(client: TestClient, world: World) -> None:
    _assign(client, world, world["mudur"], user_id=world.user_ids["temizlik"])

    _assign(client, world, world["mudur"], user_id=world.user_ids["temizlik2"])

    assert _mine(client, world["temizlik"]) == []
    assert len(_mine(client, world["temizlik2"])) == 1


# --- Personel akisi -----------------------------------------------------------------------


def test_full_flow_closes_the_case_and_reporter_can_rate(client: TestClient, world: World) -> None:
    staff = world["temizlik"]
    _assign(client, world, world["mudur"], user_id=world.user_ids["temizlik"])
    [task] = _mine(client, staff)

    assert _act(client, staff, task["id"], "accept") == 200
    assert _case(client, world)["status"] == "ACCEPTED"
    assert _act(client, staff, task["id"], "start") == 200
    assert _case(client, world)["status"] == "IN_PROGRESS"
    assert _act(client, staff, task["id"], "complete", completion_note="Dolduruldu.") == 200
    # Agent hatti kapali: dogrulamayi manager yapar (E5-11)
    waiting = _case(client, world)
    assert (waiting["status"], waiting["needs_human_review"]) == ("VERIFICATION", True)
    closed = client.post(
        f"/api/v1/cases/{world.case_id}/close",
        json={"reason": "Kontrol edildi."},
        headers=world["mudur"],
    )
    assert closed.status_code == 200

    case = _case(client, world)
    assert case["status"] == "CLOSED"
    assert case["resolved_at"] is not None
    assert {"TASK_ACCEPTED", "WORK_STARTED", "WORK_COMPLETED", "CASE_CLOSED"} <= set(
        _events(client, world)
    )
    rating = client.post(
        f"/api/v1/cases/{world.case_id}/feedback", json={"rating": 5}, headers=world["ogrenci"]
    )
    assert rating.status_code == 200


def test_task_cannot_start_before_it_is_accepted(client: TestClient, world: World) -> None:
    _assign(client, world, world["mudur"], user_id=world.user_ids["temizlik"])
    [task] = _mine(client, world["temizlik"])

    assert _act(client, world["temizlik"], task["id"], "start") == 409


def test_declined_task_goes_back_to_the_manager(client: TestClient, world: World) -> None:
    _assign(client, world, world["mudur"], user_id=world.user_ids["temizlik"])
    [task] = _mine(client, world["temizlik"])

    status = _act(client, world["temizlik"], task["id"], "decline", reason="Yetkim dışında.")

    assert status == 200
    assert _case(client, world)["status"] == "ESCALATED"
    assert _mine(client, world["temizlik"]) == []
    # Manager yeniden atayabilir
    assert _assign(client, world, world["mudur"], user_id=world.user_ids["temizlik2"])[0] == 200


def test_department_queue_task_is_claimed_by_the_first_to_accept(
    client: TestClient, world: World
) -> None:
    _assign(client, world, world["mudur"])  # yalniz departman, kisi yok
    [task] = _mine(client, world["temizlik2"])
    assert len(_mine(client, world["temizlik"])) == 1

    assert _act(client, world["temizlik2"], task["id"], "accept") == 200

    assert _mine(client, world["temizlik"]) == []
    assert _mine(client, world["temizlik2"])[0]["assigned_user_id"] == world.user_ids["temizlik2"]


def test_other_department_cannot_see_or_touch_the_task(client: TestClient, world: World) -> None:
    _assign(client, world, world["mudur"], user_id=world.user_ids["temizlik"])
    [task] = _mine(client, world["temizlik"])
    outsider = world["teknisyen"]

    assert _mine(client, outsider) == []
    assert client.get(f"/api/v1/tasks/{task['id']}", headers=outsider).status_code == 404
    assert _act(client, outsider, task["id"], "accept") == 404


def test_manager_views_but_does_not_work_tasks(client: TestClient, world: World) -> None:
    _assign(client, world, world["mudur"], user_id=world.user_ids["temizlik"])
    [task] = _mine(client, world["temizlik"])

    assert client.get(f"/api/v1/tasks/{task['id']}", headers=world["mudur"]).status_code == 200
    assert _act(client, world["mudur"], task["id"], "accept") == 403


def test_assigned_staff_can_open_the_case(client: TestClient, world: World) -> None:
    _assign(client, world, world["mudur"], department_id=world.maintenance.id)

    response = client.get(f"/api/v1/cases/{world.case_id}", headers=world["teknisyen"])

    assert response.status_code == 200


def test_department_queue_is_invisible_to_other_departments(
    client: TestClient, world: World
) -> None:
    _assign(client, world, world["mudur"])  # Destek Hizmetleri kuyrugu, kisi yok
    [task] = _mine(client, world["temizlik"])

    assert _mine(client, world["teknisyen"]) == []
    assert client.get(f"/api/v1/tasks/{task['id']}", headers=world["teknisyen"]).status_code == 404
