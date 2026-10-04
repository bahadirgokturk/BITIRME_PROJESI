"""Bildirim KPI'lari ve dagilimlari (E6-2, E6-3; docs/ANALYTICS.md bolum 1-2).

Kucuk, elle kurulmus bir kampus: her beklenen deger asagidaki zaman cizelgesinden elle hesaplandi.
Saat: 26.09.2026 15:00 (Istanbul). Varsayilan donem: 20-26.09, onceki donem: 13-19.09.

  c1 SABUN A-1-WC  21.09 10:00  atama +10, kabul +30, cozum +90, kapanis +100; SLA +120 (tuttu)
  c2 SABUN A-1-WC  22.09 09:00  atama +20, kabul +60, cozum +180, kapanis +190; SLA +120 (asti),
                                yeniden acildi, SLA_BREACHED olayi, AI karari duzeltildi
  c3 PROJ  B-101   24.09 11:00  atama +30, kabul yok (ASSIGNED); SLA +240
  c4 PROJ  B-101   26.09 13:30  CLASSIFIED (bugun)
  c5 SABUN A-1-WC  21.09 10:05  MERGED (sayimlara girmez)
  c6 SABUN A-1-WC  15.09 08:00  onceki donem: cozum +60, kapanis +70; SLA +120 (tuttu)
  c7 PROJ  BAHCE   26.09 05:00  atama +15, kabul +45, IN_PROGRESS (bugun)

Supervisor: c1 AUTO_ASSIGN, c2 AUTO_ASSIGN (+ duzeltme), c3 SEND_TO_HUMAN_REVIEW, c4 ESCALATE.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from itertools import count
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import AgentDecision, Case, CaseEvent, CaseType, Department, Location, Organization
from app.models.enums import (
    ActorType,
    CaseCategory,
    CaseEventType,
    CaseStatus,
    LocationKind,
    Priority,
    UserRole,
)
from tests.integration.conftest import FrozenClock
from tests.integration.factories import bearer, make_organization, make_user

TURKEY = timezone(timedelta(hours=3))
NOW = datetime(2026, 9, 26, 15, 0, tzinfo=TURKEY)
MANAGER_EMAIL = "mudur@kampus.example.com"
_numbers = count(1)


def tr(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 9, day, hour, minute, tzinfo=TURKEY)


def after(start: datetime, minutes: int) -> datetime:
    return start + timedelta(minutes=minutes)


@dataclass
class World:
    organization: Organization
    cleaning: Department
    maintenance: Department
    locations: dict[str, Location]
    soap: CaseType
    projector: CaseType
    reporter_id: int
    headers: dict[str, str]


def _location(session: Session, world_org: Organization, path: str, kind: LocationKind) -> Location:
    code = path.rsplit("/", 1)[-1]
    parent = path.rsplit("/", 1)[0] if "/" in path else None
    location = Location(
        organization_id=world_org.id,
        kind=kind,
        code=code,
        name=f"{code} adi",
        path=path,
        importance_weight=50,
    )
    if parent:
        location.parent_id = (
            session.query(Location).filter_by(organization_id=world_org.id, path=parent).one().id
        )
    session.add(location)
    session.flush()
    return location


def _case_type(
    session: Session, organization: Organization, code: str, category: CaseCategory
) -> CaseType:
    case_type = CaseType(
        organization_id=organization.id,
        code=code,
        name=f"{code} adi",
        category=category,
        base_priority=Priority.MEDIUM,
        base_severity=40,
    )
    session.add(case_type)
    session.flush()
    return case_type


TREE = [
    ("KMP", LocationKind.CAMPUS),
    ("KMP/A", LocationKind.BUILDING),
    ("KMP/A/A-1", LocationKind.FLOOR),
    ("KMP/A/A-1/A-1-WC", LocationKind.WC),
    ("KMP/B", LocationKind.BUILDING),
    ("KMP/B/B-1", LocationKind.FLOOR),
    ("KMP/B/B-1/B-101", LocationKind.ROOM),
    # Bina disi alan: kat ve bina yok, kendisi grup olur
    ("KMP/BHC", LocationKind.OUTDOOR),
]


def add_case(session: Session, world: World, created: datetime, **fields: Any) -> Case:
    case = Case(
        organization_id=world.organization.id,
        case_number=f"CASE-{next(_numbers):06d}",
        title="Test",
        description="Test bildirimi",
        reporter_id=world.reporter_id,
        created_at=created,
        **fields,
    )
    session.add(case)
    session.flush()
    return case


def add_event(session: Session, case: Case, event: CaseEventType, actor: ActorType) -> None:
    session.add(
        CaseEvent(case_id=case.id, event_type=event, actor_type=actor, occurred_at=case.created_at)
    )


def add_supervisor(session: Session, case: Case, decision: str) -> None:
    session.add(
        AgentDecision(
            case_id=case.id,
            run_id=uuid.uuid4(),
            agent_name="supervisor",
            decision=decision,
            reason_json=[],
            input_snapshot={},
            output_json={},
            model="rules@1.0",
            latency_ms=1,
            created_at=after(case.created_at, 1),
        )
    )


def _soap(world: World, created: datetime) -> dict[str, Any]:
    return {
        "case_type_id": world.soap.id,
        "category": CaseCategory.CONSUMABLE,
        "location_id": world.locations["KMP/A/A-1/A-1-WC"].id,
        "department_id": world.cleaning.id,
        "priority": Priority.MEDIUM,
        "due_at": after(created, 120),
    }


def _projector(world: World, location: str) -> dict[str, Any]:
    return {
        "case_type_id": world.projector.id,
        "category": CaseCategory.TECHNICAL,
        "location_id": world.locations[location].id,
        "department_id": world.maintenance.id,
        "priority": Priority.HIGH,
    }


def _closed(created: datetime, steps: tuple[int, int, int, int]) -> dict[str, Any]:
    assigned, accepted, resolved, closed = steps
    return {
        "status": CaseStatus.CLOSED,
        "assigned_at": after(created, assigned),
        "accepted_at": after(created, accepted),
        "resolved_at": after(created, resolved),
        "closed_at": after(created, closed),
    }


def _add_cases(session: Session, world: World) -> None:
    c1 = add_case(
        session,
        world,
        tr(21, 10),
        **_soap(world, tr(21, 10)),
        **_closed(tr(21, 10), (10, 30, 90, 100)),
    )
    c2 = add_case(
        session,
        world,
        tr(22, 9),
        **_soap(world, tr(22, 9)),
        **_closed(tr(22, 9), (20, 60, 180, 190)),
        reopened_count=1,
    )
    c3 = add_case(
        session,
        world,
        tr(24, 11),
        **_projector(world, "KMP/B/B-1/B-101"),
        status=CaseStatus.ASSIGNED,
        assigned_at=tr(24, 11, 30),
        due_at=after(tr(24, 11), 240),
    )
    c4 = add_case(
        session,
        world,
        tr(26, 13, 30),
        **_projector(world, "KMP/B/B-1/B-101"),
        status=CaseStatus.CLASSIFIED,
    )
    add_case(session, world, tr(21, 10, 5), **_soap(world, tr(21, 10, 5)), status=CaseStatus.MERGED)
    add_case(
        session, world, tr(15, 8), **_soap(world, tr(15, 8)), **_closed(tr(15, 8), (5, 10, 60, 70))
    )
    add_case(
        session,
        world,
        tr(26, 5),
        **_projector(world, "KMP/BHC"),
        status=CaseStatus.IN_PROGRESS,
        assigned_at=tr(26, 5, 15),
        accepted_at=tr(26, 5, 45),
    )
    add_event(session, c2, CaseEventType.SLA_BREACHED, ActorType.SYSTEM)
    add_event(session, c2, CaseEventType.DECISION_OVERRIDDEN, ActorType.USER)
    for case, decision in (
        (c1, "AUTO_ASSIGN"),
        (c2, "AUTO_ASSIGN"),
        (c3, "SEND_TO_HUMAN_REVIEW"),
        (c4, "ESCALATE"),
    ):
        add_supervisor(session, case, decision)
    session.flush()


@pytest.fixture
def world(client: TestClient, db_session: Session, clock: FrozenClock) -> World:
    clock.current = NOW.astimezone(UTC)
    organization = make_organization(db_session)
    locations = {path: _location(db_session, organization, path, kind) for path, kind in TREE}
    cleaning = Department(organization_id=organization.id, code="CLEAN", name="Temizlik")
    maintenance = Department(organization_id=organization.id, code="MAINT", name="Bakım")
    db_session.add_all([cleaning, maintenance])
    db_session.flush()
    reporter = make_user(db_session, email="ogrenci@kampus.example.com", organization=organization)
    make_user(db_session, email=MANAGER_EMAIL, role=UserRole.MANAGER, organization=organization)
    world = World(
        organization=organization,
        cleaning=cleaning,
        maintenance=maintenance,
        locations=locations,
        soap=_case_type(db_session, organization, "SOAP", CaseCategory.CONSUMABLE),
        projector=_case_type(db_session, organization, "PROJ", CaseCategory.TECHNICAL),
        reporter_id=reporter.id,
        headers=bearer(client, MANAGER_EMAIL),
    )
    _add_cases(db_session, world)
    return world


def get(client: TestClient, world: World, path: str, **params: Any) -> Any:
    response = client.get(f"/api/v1/analytics/{path}", params=params, headers=world.headers)
    assert response.status_code == 200, response.text
    return response.json()


# --- KPI kartlari ---------------------------------------------------------------------------


def test_kpis_compare_with_the_previous_period(client: TestClient, world: World) -> None:
    body = get(client, world, "kpis")

    assert body["period"] == {"from": "2026-09-20", "to": "2026-09-26"}
    # c1 c2 c3 c4 c7 (c5 birlestirildi); onceki donem c6
    assert body["total_cases"] == {"value": 5, "previous": 1, "delta_pct": 400.0}
    # Simdi acik: c3 c4 c7. Donem basinda acik olan yoktu: degisim hesaplanmaz
    assert body["open_cases"] == {"value": 3, "previous": 0, "delta_pct": None}
    assert body["closed_cases"] == {"value": 2, "previous": 1, "delta_pct": 100.0}
    # Bugun: c4 c7; dun: yok
    assert body["cases_today"] == {"value": 2, "previous": 0, "delta_pct": None}


def test_kpis_durations_are_minutes(client: TestClient, world: World) -> None:
    body = get(client, world, "kpis")

    # Cozulen: c1 90, c2 180; onceki c6 60
    assert body["avg_resolution_min"] == {"value": 135.0, "previous": 60.0, "delta_pct": 125.0}
    assert body["median_resolution_min"]["value"] == 135.0
    # Kabul: c1 30, c2 60, c7 45
    assert body["median_first_response_min"]["value"] == 45.0
    # Atama: c1 10, c2 20, c3 30, c7 15
    assert body["median_assignment_min"]["value"] == 17.5


def test_kpis_sla_reopen_and_automation_rates(client: TestClient, world: World) -> None:
    body = get(client, world, "kpis")

    # Kapanan ve SLA'li: c1 tuttu, c2 asti; onceki c6 tuttu
    assert body["sla_compliance_pct"] == {"value": 50.0, "previous": 100.0, "delta_pct": -50.0}
    # SLA'li acilan c1 c2 c3; ihlal olayi c2
    assert body["sla_breach_pct"]["value"] == 33.3
    assert body["reopen_pct"]["value"] == 50.0
    # Analiz edilen 4; insan dokunmadan atanan c1 (c2 duzeltildi); incelemeye giden c3 c4
    assert body["automation_pct"]["value"] == 25.0
    assert body["human_review_pct"]["value"] == 50.0


def test_empty_period_has_no_rates(client: TestClient, world: World) -> None:
    body = get(client, world, "kpis", **{"from": "2026-08-01", "to": "2026-08-07"})

    assert body["total_cases"]["value"] == 0
    assert body["avg_resolution_min"]["value"] is None
    assert body["sla_compliance_pct"]["value"] is None
    assert body["automation_pct"]["value"] is None


def test_department_and_building_filters(client: TestClient, world: World) -> None:
    by_department = get(client, world, "kpis", department_id=world.maintenance.id)
    by_building = get(client, world, "kpis", building_id=world.locations["KMP/A"].id)

    assert by_department["total_cases"]["value"] == 3
    assert by_building["total_cases"]["value"] == 2


def test_building_of_another_organization_is_not_found(
    client: TestClient, world: World, db_session: Session
) -> None:
    other = _location(db_session, make_organization(db_session), "DIS", LocationKind.BUILDING)

    response = client.get(
        "/api/v1/analytics/kpis", params={"building_id": other.id}, headers=world.headers
    )

    assert response.status_code == 404


# --- Dagilimlar -----------------------------------------------------------------------------


def test_daily_trend_fills_empty_days(client: TestClient, world: World) -> None:
    body = get(client, world, "trend")

    points = {p["bucket"]: (p["opened"], p["closed"]) for p in body["points"]}
    assert len(points) == 7
    assert points["2026-09-20"] == (0, 0)
    assert points["2026-09-21"] == (1, 1)
    assert points["2026-09-22"] == (1, 1)
    assert points["2026-09-26"] == (2, 0)


def test_weekly_trend_starts_on_monday(client: TestClient, world: World) -> None:
    body = get(client, world, "trend", granularity="week")

    assert body["points"] == [
        {"bucket": "2026-09-14", "opened": 0, "closed": 0},
        {"bucket": "2026-09-21", "opened": 5, "closed": 2},
    ]


def test_categories_break_down_by_case_type(client: TestClient, world: World) -> None:
    body = get(client, world, "categories")

    assert body["total"] == 5
    first, second = body["items"]
    assert (first["category"], first["count"]) == ("TECHNICAL", 3)
    assert first["label"] == "Teknik"
    assert first["case_types"] == [{"code": "PROJ", "name": "PROJ adi", "count": 3}]
    assert (second["category"], second["count"]) == ("CONSUMABLE", 2)


@pytest.mark.parametrize(
    ("level", "expected"),
    [
        ("building", [("KMP/A", 2), ("KMP/B", 2), ("KMP/BHC", 1)]),
        ("floor", [("KMP/A/A-1", 2), ("KMP/B/B-1", 2), ("KMP/BHC", 1)]),
        ("area", [("KMP/A/A-1/A-1-WC", 2), ("KMP/B/B-1/B-101", 2), ("KMP/BHC", 1)]),
    ],
)
def test_locations_roll_up_to_the_requested_level(
    client: TestClient, world: World, level: str, expected: list[tuple[str, int]]
) -> None:
    body = get(client, world, "locations", level=level)

    assert [(i["location"]["path"], i["count"]) for i in body["items"]] == expected
    assert body["items"][0]["by_category"] == {"CONSUMABLE": 2}


def test_resolution_times_per_category(client: TestClient, world: World) -> None:
    body = get(client, world, "resolution-times")

    assert body["items"] == [
        {
            "category": "CONSUMABLE",
            "label": "Sarf malzemesi",
            "count": 2,
            "avg_min": 135.0,
            "median_min": 135.0,
            # p90: 90 ile 180 arasinda dogrusal ara deger, 90 + 0,9 x 90
            "p90_min": 171.0,
        }
    ]


def test_sla_report_by_priority(client: TestClient, world: World) -> None:
    body = get(client, world, "sla")

    assert (body["with_sla"], body["met"], body["breached"]) == (2, 1, 1)
    assert body["compliance_pct"] == 50.0
    rows = {r["priority"]: r for r in body["by_priority"]}
    assert list(rows) == ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert rows["MEDIUM"]["compliance_pct"] == 50.0
    assert rows["HIGH"] == {
        "priority": "HIGH",
        "with_sla": 0,
        "met": 0,
        "breached": 0,
        "compliance_pct": None,
    }


def test_aging_buckets_open_cases_by_hours(client: TestClient, world: World) -> None:
    body = get(client, world, "aging")

    # c4 1,5 sa; c7 10 sa; c3 52 sa
    assert body["total_open"] == 3
    assert [(b["label"], b["count"]) for b in body["buckets"]] == [
        ("0-2 sa", 1),
        ("2-6 sa", 0),
        ("6-12 sa", 1),
        ("12-24 sa", 0),
        ("24+ sa", 1),
    ]
    assert body["buckets"][-1]["max_hours"] is None
