"""SLA (E4-2): atamada hedef sure, okuma aninda durum, tipe ozel kural, yeniden atama."""

from dataclasses import dataclass
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Case, CaseType, Organization, SlaRule
from app.models.enums import CaseCategory, Priority, UserRole
from tests.integration.conftest import FrozenClock
from tests.integration.factories import (
    bearer,
    make_department,
    make_location,
    make_organization,
    make_user,
)

Headers = dict[str, str]


@dataclass
class World:
    organization: Organization
    case_id: int
    department_id: int
    staff_id: int
    names: tuple[str, ...]

    def login(self, client: TestClient) -> dict[str, Headers]:
        # Saat ileri alininca 30 dk'lik access token biter; her adimda yeniden giris
        return {name: bearer(client, f"{name}@kampus-a.edu.tr") for name in self.names}


def _rule(organization: Organization, **fields: object) -> SlaRule:
    values: dict[str, object] = {
        "priority": Priority.MEDIUM,
        "response_minutes": 120,
        "resolution_minutes": 480,
        "warning_threshold_pct": 75,
    } | fields
    return SlaRule(organization_id=organization.id, **values)


@pytest.fixture
def world(client: TestClient, db_session: Session) -> World:
    organization = make_organization(db_session)
    department = make_department(db_session, organization, "SUPPORT_SERVICES")
    people = {
        "ogrenci": (UserRole.REPORTER, None),
        "temizlik": (UserRole.STAFF, department.id),
        "temizlik2": (UserRole.STAFF, department.id),
        "mudur": (UserRole.MANAGER, department.id),
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
    location = make_location(db_session, organization)
    body = {"description": "Tuvalette sabunluk tamamen boş.", "location_id": location.id}
    headers = bearer(client, "ogrenci@kampus-a.edu.tr")
    created = client.post("/api/v1/cases", json=body, headers=headers).json()
    return World(organization, created["id"], department.id, ids["temizlik"], tuple(people))


def _assign(client: TestClient, world: World, user: str = "temizlik") -> dict[str, object]:
    headers = world.login(client)
    staff_id = world.staff_id if user == "temizlik" else None
    body = {"department_id": world.department_id, "user_id": staff_id}
    response = client.post(
        f"/api/v1/cases/{world.case_id}/assign", json=body, headers=headers["mudur"]
    )
    assert response.status_code == 200, response.text
    case: dict[str, object] = response.json()
    return case


def _read(client: TestClient, world: World) -> tuple[dict[str, object], dict[str, object]]:
    headers = world.login(client)
    case = client.get(f"/api/v1/cases/{world.case_id}", headers=headers["mudur"]).json()
    tasks = client.get("/api/v1/tasks/mine", headers=headers["temizlik"]).json()["items"]
    return case, (tasks[0] if tasks else {})


def _at(value: object) -> datetime:
    return datetime.fromisoformat(str(value))


def test_assignment_sets_targets_from_the_default_rule(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    db_session.add(_rule(world.organization))
    db_session.flush()

    case = _assign(client, world)

    created = _at(case["created_at"])
    assert _at(case["due_at"]) == created + timedelta(minutes=480)
    assert case["sla_status"] == "ON_TRACK"


@pytest.mark.parametrize(
    ("elapsed", "expected"),
    [(timedelta(hours=6), "AT_RISK"), (timedelta(hours=8, minutes=1), "BREACHED")],
)
def test_status_changes_as_time_passes(
    client: TestClient,
    db_session: Session,
    clock: FrozenClock,
    world: World,
    elapsed: timedelta,
    expected: str,
) -> None:
    db_session.add(_rule(world.organization))
    db_session.flush()
    _assign(client, world)

    clock.advance(elapsed)
    case, task = _read(client, world)

    assert case["sla_status"] == expected
    assert task["sla_status"] == expected


def test_case_type_rule_wins_over_the_default(
    client: TestClient, db_session: Session, world: World
) -> None:
    soap = CaseType(
        organization_id=world.organization.id,
        code="SOAP_EMPTY",
        name="Sabun bitti",
        category=CaseCategory.CONSUMABLE,
        base_priority=Priority.LOW,
        base_severity=20,
    )
    db_session.add(soap)
    db_session.flush()
    db_session.add_all(
        [
            _rule(world.organization, priority=Priority.LOW, resolution_minutes=1440),
            _rule(
                world.organization,
                case_type_id=soap.id,
                priority=Priority.LOW,
                resolution_minutes=240,
            ),
        ]
    )
    case_row = db_session.get(Case, world.case_id)
    assert case_row is not None
    case_row.case_type_id = soap.id
    db_session.flush()

    case = _assign(client, world)

    # Oncelik yokken bildirim tipinin baslangic onceligi (LOW) kullanilir
    assert _at(case["due_at"]) == _at(case["created_at"]) + timedelta(minutes=240)


def test_reassignment_does_not_reset_the_clock(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    rule = _rule(world.organization)
    db_session.add(rule)
    db_session.flush()
    first = _assign(client, world)
    clock.advance(timedelta(hours=3))
    # Kural sonradan degisse de verilmis soz (hedef) degismez
    rule.resolution_minutes = 60
    db_session.flush()

    second = _assign(client, world, user="kuyruk")

    assert second["due_at"] == first["due_at"]


def test_finished_in_time_stays_on_track(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    db_session.add(_rule(world.organization))
    db_session.flush()
    _assign(client, world)
    headers = world.login(client)
    [task] = client.get("/api/v1/tasks/mine", headers=headers["temizlik"]).json()["items"]
    for action, body in (("accept", None), ("start", None), ("complete", {})):
        url = f"/api/v1/tasks/{task['id']}/{action}"
        assert client.post(url, json=body, headers=headers["temizlik"]).status_code == 200
    # Agent hatti kapali: dogrulamayi manager yapar (E5-11)
    close = f"/api/v1/cases/{task['case_id']}/close"
    assert client.post(close, json={"reason": "r"}, headers=headers["mudur"]).status_code == 200

    clock.advance(timedelta(days=10))
    case, _ = _read(client, world)

    assert case["status"] == "CLOSED"
    assert case["sla_status"] == "ON_TRACK"


def test_without_rules_there_is_no_target(client: TestClient, world: World) -> None:
    case = _assign(client, world)

    assert case["due_at"] is None
    assert case["sla_status"] is None
