"""Birim performansi, tekrarlayan sorunlar ve surec analizi (E6-3; docs/ANALYTICS.md bolum 2).

Saat 26.09.2026 15:00 (Istanbul), donem 20-26.09, tekrar penceresi 28.08-26.09 (30 gun).

  SABUN A-1-WC  28.08, 02.09, 20.09, 22.09, 24.09, 25.09  hepsi cozum +60, kapanis +70; SLA +120,
                25.09'da SLA +30 (asti)
  SABUN A-1-WC  20.08 (pencere disi), 23.09 MERGED (sayilmaz)
  SABUN BAHCE   18.09 ASSIGNED, CLEAN'de bekleyen gorev
  PROJ  B-101   21.09 cozum +300 (SLA +240 asti, gorev bitti), 22.09 ASSIGNED (gorev kabul edildi),
                23.09 IN_PROGRESS (gorev suruyor), 24.09 CLASSIFIED -> 4 bildirim, esigin altinda
  Personel: CLEAN 2 aktif + 1 pasif, MAINT 1 aktif; SEC biriminde ne bildirim ne personel var.
  Olay kaydi: 22.09 ve 24.09 sabun bildirimleri (adim sureleri asagida); 02.09 donem disi.
"""

from datetime import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Case, Department
from app.models.enums import CaseEventType, CaseStatus, TaskStatus
from tests.integration.analytics_world import (
    GARDEN,
    World,
    add_case,
    add_event,
    add_staff,
    add_task,
    after,
    build_world,
    closed,
    get,
    projector,
    soap,
    tr,
)
from tests.integration.conftest import FrozenClock

E = CaseEventType
# (olay, bildirimden itibaren dakika)
FLOW_22 = [
    (E.CASE_CREATED, 0),
    (E.TASK_CREATED, 1),
    (E.TASK_ACCEPTED, 21),
    (E.WORK_STARTED, 31),
    (E.WORK_COMPLETED, 61),
    (E.CASE_CLOSED, 62),
]
FLOW_24 = [
    (E.CASE_CREATED, 0),
    (E.TASK_CREATED, 1),
    (E.TASK_ACCEPTED, 41),
    (E.WORK_STARTED, 46),
    (E.WORK_COMPLETED, 106),
    (E.CASE_CLOSED, 108),
    # Yeniden atama: adim suresi ilk gorevden olculur
    (E.TASK_CREATED, 200),
]
# Donem disi; sayilsaydi ortalamalar degisirdi
FLOW_OLD = [(E.CASE_CREATED, 0), (E.TASK_CREATED, 500)]


def _soap_closed(world: World, created: datetime, *, due_minutes: int = 120) -> dict[str, Any]:
    fields = soap(world, created) | closed(created, (5, 10, 60, 70))
    return fields | {"due_at": after(created, due_minutes)}


def _flow(session: Session, case: Case, flow: list[tuple[CaseEventType, int]]) -> None:
    for event, minutes in flow:
        add_event(session, case, event, at=after(case.created_at, minutes))


def _add_cleaning(session: Session, world: World) -> None:
    recurring = [tr(28, 10, month=8), tr(2, 10), tr(20, 10), tr(22, 10), tr(24, 10)]
    cases = {
        when: add_case(session, world, when, **_soap_closed(world, when)) for when in recurring
    }
    add_case(session, world, tr(25, 10), **_soap_closed(world, tr(25, 10), due_minutes=30))
    add_case(session, world, tr(20, 10, month=8), **_soap_closed(world, tr(20, 10, month=8)))
    add_case(session, world, tr(23, 10), **soap(world, tr(23, 10)), status=CaseStatus.MERGED)
    waiting = add_case(
        session, world, tr(18, 9), **soap(world, tr(18, 9), GARDEN), status=CaseStatus.ASSIGNED
    )
    add_task(session, waiting, world.cleaning, TaskStatus.PENDING)
    _flow(session, cases[tr(22, 10)], FLOW_22)
    _flow(session, cases[tr(24, 10)], FLOW_24)
    _flow(session, cases[tr(2, 10)], FLOW_OLD)


def _add_maintenance(session: Session, world: World) -> None:
    done_fields = projector(world) | closed(tr(21, 9), (5, 10, 300, 310))
    done = add_case(session, world, tr(21, 9), **done_fields, due_at=after(tr(21, 9), 240))
    add_task(session, done, world.maintenance, TaskStatus.COMPLETED)
    for day, status, task in (
        (22, CaseStatus.ASSIGNED, TaskStatus.ACCEPTED),
        (23, CaseStatus.IN_PROGRESS, TaskStatus.IN_PROGRESS),
    ):
        case = add_case(session, world, tr(day, 9), **projector(world), status=status)
        add_task(session, case, world.maintenance, task)
    add_case(session, world, tr(24, 9), **projector(world), status=CaseStatus.CLASSIFIED)


@pytest.fixture
def world(client: TestClient, db_session: Session, clock: FrozenClock) -> World:
    world = build_world(client, db_session, clock)
    db_session.add(Department(organization_id=world.organization.id, code="SEC", name="Güvenlik"))
    for department, active in (
        (world.cleaning, True),
        (world.cleaning, True),
        (world.cleaning, False),
        (world.maintenance, True),
    ):
        add_staff(db_session, world, department, is_active=active)
    _add_cleaning(db_session, world)
    _add_maintenance(db_session, world)
    db_session.flush()
    return world


# --- Birim performansi ----------------------------------------------------------------------


def test_department_performance(client: TestClient, world: World) -> None:
    body = get(client, world, "departments")

    rows = {row["department"]["code"]: row for row in body["items"]}
    assert list(rows) == ["CLEAN", "MAINT", "SEC"]
    assert rows["CLEAN"] | {"department": None} == {
        "department": None,
        "cases": 4,
        "avg_resolution_min": 60.0,
        "median_resolution_min": 60.0,
        # 20, 22, 24 tuttu; 25 asti
        "sla_compliance_pct": 75.0,
        "open_tasks": 1,
        # Pasif personel sayilmaz
        "active_staff": 2,
        "open_tasks_per_staff": 0.5,
    }
    assert rows["MAINT"]["cases"] == 4
    assert rows["MAINT"]["median_resolution_min"] == 300.0
    assert rows["MAINT"]["sla_compliance_pct"] == 0.0
    assert (rows["MAINT"]["open_tasks"], rows["MAINT"]["open_tasks_per_staff"]) == (2, 2.0)
    assert rows["SEC"]["cases"] == 0
    assert rows["SEC"]["open_tasks_per_staff"] is None


def test_department_filter_keeps_one_row(client: TestClient, world: World) -> None:
    body = get(client, world, "departments", department_id=world.maintenance.id)

    assert [row["department"]["code"] for row in body["items"]] == ["MAINT"]


# --- Tekrarlayan sorunlar -------------------------------------------------------------------


def test_recurring_problem_in_the_last_30_days(client: TestClient, world: World) -> None:
    body = get(client, world, "recurring")

    assert (body["threshold"], body["window_days"]) == (5, 30)
    (item,) = body["items"]
    assert item["location"]["path"] == "KMP/A/A-1/A-1-WC"
    assert item["case_type"]["code"] == "SOAP"
    # 28.08 pencerenin ilk gunu; 20.08 disarida, birlestirilen sayilmaz. Projektor 4: esik alti
    assert item["count"] == 6
    assert datetime.fromisoformat(item["last_reported_at"]) == tr(25, 10)
    assert item["avg_resolution_min"] == 60.0
    # Ilk yari 2, ikinci yari 4
    assert item["trend"] == "up"
    assert "periyodik" in item["suggestion"]


def test_recurring_respects_department_filter(client: TestClient, world: World) -> None:
    body = get(client, world, "recurring", department_id=world.maintenance.id)

    assert body["items"] == []


# --- Surec analizi --------------------------------------------------------------------------


def test_process_steps_and_bottleneck(client: TestClient, world: World) -> None:
    body = get(client, world, "process")

    steps = {(s["from_event"], s["to_event"]): s for s in body["steps"]}
    expected = {
        ("CASE_CREATED", "TASK_CREATED"): 1.0,
        ("TASK_CREATED", "TASK_ACCEPTED"): 30.0,
        ("TASK_ACCEPTED", "WORK_STARTED"): 7.5,
        ("WORK_STARTED", "WORK_COMPLETED"): 45.0,
        ("WORK_COMPLETED", "CASE_CLOSED"): 1.5,
    }
    assert list(steps) == list(expected)
    assert {key: step["median_min"] for key, step in steps.items()} == expected
    assert all(step["count"] == 2 for step in steps.values())
    assert body["bottleneck"]["to_event"] == "WORK_COMPLETED"
    assert body["bottleneck"]["label"] == "İşin yapılması"


def test_process_without_events_has_no_bottleneck(client: TestClient, world: World) -> None:
    body = get(client, world, "process", **{"from": "2026-07-01", "to": "2026-07-07"})

    assert all(step["count"] == 0 and step["median_min"] is None for step in body["steps"])
    assert body["bottleneck"] is None
