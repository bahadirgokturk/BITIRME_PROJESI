"""Analitik testlerinin ortak kucuk kampusu (seed degil; zaman damgalari elle verilir).

Saat: 26.09.2026 15:00 (Istanbul). Agac:
  KMP (kampus) / A (bina) / A-1 (kat) / A-1-WC
              / B (bina) / B-1 (kat) / B-101
              / BHC (bahce: bina disi, kat yok)
Birimler: CLEAN (Temizlik), MAINT (Bakim). Turler: SOAP (sarf), PROJ (teknik).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal
from itertools import count
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    AgentDecision,
    Case,
    CaseEvent,
    CaseType,
    DecisionFeedback,
    Department,
    Location,
    Organization,
    Task,
    User,
)
from app.models.enums import (
    ActorType,
    CaseCategory,
    CaseEventType,
    CaseStatus,
    LocationKind,
    Priority,
    TaskStatus,
    UserRole,
)
from tests.integration.conftest import FrozenClock
from tests.integration.factories import bearer, make_organization, make_user

TURKEY = timezone(timedelta(hours=3))
NOW = datetime(2026, 9, 26, 15, 0, tzinfo=TURKEY)
MANAGER_EMAIL = "mudur@kampus.example.com"
WC = "KMP/A/A-1/A-1-WC"
ROOM = "KMP/B/B-1/B-101"
GARDEN = "KMP/BHC"
TREE = [
    ("KMP", LocationKind.CAMPUS),
    ("KMP/A", LocationKind.BUILDING),
    ("KMP/A/A-1", LocationKind.FLOOR),
    (WC, LocationKind.WC),
    ("KMP/B", LocationKind.BUILDING),
    ("KMP/B/B-1", LocationKind.FLOOR),
    (ROOM, LocationKind.ROOM),
    (GARDEN, LocationKind.OUTDOOR),
]
_numbers = count(1)
_emails = count(1)


def tr(day: int, hour: int, minute: int = 0, *, month: int = 9) -> datetime:
    return datetime(2026, month, day, hour, minute, tzinfo=TURKEY)


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


def make_location(
    session: Session, organization: Organization, path: str, kind: LocationKind
) -> Location:
    code = path.rsplit("/", 1)[-1]
    location = Location(
        organization_id=organization.id,
        kind=kind,
        code=code,
        name=f"{code} adi",
        path=path,
        importance_weight=50,
    )
    if "/" in path:
        parent_path = path.rsplit("/", 1)[0]
        location.parent_id = (
            session.query(Location)
            .filter_by(organization_id=organization.id, path=parent_path)
            .one()
            .id
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


def build_world(client: TestClient, session: Session, clock: FrozenClock) -> World:
    clock.current = NOW.astimezone(UTC)
    organization = make_organization(session)
    locations = {path: make_location(session, organization, path, kind) for path, kind in TREE}
    cleaning = Department(organization_id=organization.id, code="CLEAN", name="Temizlik")
    maintenance = Department(organization_id=organization.id, code="MAINT", name="Bakım")
    session.add_all([cleaning, maintenance])
    session.flush()
    reporter = make_user(session, email="ogrenci@kampus.example.com", organization=organization)
    make_user(session, email=MANAGER_EMAIL, role=UserRole.MANAGER, organization=organization)
    return World(
        organization=organization,
        cleaning=cleaning,
        maintenance=maintenance,
        locations=locations,
        soap=_case_type(session, organization, "SOAP", CaseCategory.CONSUMABLE),
        projector=_case_type(session, organization, "PROJ", CaseCategory.TECHNICAL),
        reporter_id=reporter.id,
        headers=bearer(client, MANAGER_EMAIL),
    )


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


def add_event(
    session: Session,
    case: Case,
    event: CaseEventType,
    *,
    actor: ActorType = ActorType.SYSTEM,
    at: datetime | None = None,
) -> None:
    occurred_at = at or case.created_at
    session.add(
        CaseEvent(case_id=case.id, event_type=event, actor_type=actor, occurred_at=occurred_at)
    )


def add_decision(
    session: Session, case: Case, agent: str, decision: str, *, confidence: str | None = None
) -> AgentDecision:
    row = AgentDecision(
        case_id=case.id,
        run_id=uuid.uuid4(),
        agent_name=agent,
        decision=decision,
        confidence=Decimal(confidence) if confidence else None,
        reason_json=[],
        input_snapshot={},
        output_json={},
        model="rules@1.0",
        latency_ms=1,
        created_at=after(case.created_at, 1),
    )
    session.add(row)
    session.flush()
    return row


def add_supervisor(session: Session, case: Case, decision: str) -> None:
    add_decision(session, case, "supervisor", decision)


def add_feedback(session: Session, decision: AgentDecision, field: str, corrected: str) -> None:
    """Manager'in AI kararini duzeltmesi (decision_feedback)."""
    manager_id = session.query(User).filter_by(email=MANAGER_EMAIL).one().id
    session.add(
        DecisionFeedback(
            decision_id=decision.id,
            case_id=decision.case_id,
            user_id=manager_id,
            field=field,
            original_value=decision.decision,
            corrected_value=corrected,
            reason="Test duzeltmesi",
            created_at=after(decision.created_at, 5),
        )
    )


def add_task(session: Session, case: Case, department: Department, status: TaskStatus) -> None:
    session.add(Task(case_id=case.id, department_id=department.id, title="Gorev", status=status))
    session.flush()


def add_staff(
    session: Session, world: World, department: Department, *, is_active: bool = True
) -> None:
    make_user(
        session,
        email=f"personel{next(_emails)}@kampus.example.com",
        role=UserRole.STAFF,
        organization=world.organization,
        department_id=department.id,
        is_active=is_active,
    )


def soap(world: World, created: datetime, location: str = WC) -> dict[str, Any]:
    return {
        "case_type_id": world.soap.id,
        "category": CaseCategory.CONSUMABLE,
        "location_id": world.locations[location].id,
        "department_id": world.cleaning.id,
        "priority": Priority.MEDIUM,
        "due_at": after(created, 120),
    }


def projector(world: World, location: str = ROOM) -> dict[str, Any]:
    return {
        "case_type_id": world.projector.id,
        "category": CaseCategory.TECHNICAL,
        "location_id": world.locations[location].id,
        "department_id": world.maintenance.id,
        "priority": Priority.HIGH,
    }


def closed(created: datetime, steps: tuple[int, int, int, int]) -> dict[str, Any]:
    """(atama, kabul, cozum, kapanis) dakika olarak olusturmadan itibaren."""
    assigned, accepted, resolved, closed_at = steps
    return {
        "status": CaseStatus.CLOSED,
        "assigned_at": after(created, assigned),
        "accepted_at": after(created, accepted),
        "resolved_at": after(created, resolved),
        "closed_at": after(created, closed_at),
    }


def get(client: TestClient, world: World, path: str, **params: Any) -> Any:
    response = client.get(f"/api/v1/analytics/{path}", params=params, headers=world.headers)
    assert response.status_code == 200, response.text
    return response.json()
