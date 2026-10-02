"""Monitoring Agent (E5-10, docs/AGENTS.md 4.8): periyodik izleme. SLA uyarisi ve asimi, kabul
edilmeyen gorev icin baska personel onerisi, takilan analiz ve yanitsiz ek bilgi talebi.

Turu (tick) testler dogrudan cagirir; zamanlayici ve kilit ayrica denenir.
"""

from dataclasses import dataclass
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models import AgentDecision, Case, CaseEvent, Organization, User
from app.models.enums import CaseStatus
from app.repositories import location_repository
from app.services.monitoring_service import MONITORING_LOCK_KEY, MonitoringService, run_locked
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.conftest import FrozenClock
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
Headers = dict[str, str]
SOAP = "Tuvalette sabun bitmiş, sabunluklar bomboş"
# Sabun SLA'si (seed): kabul 60 dk, cozum 240 dk, uyari %75 (180. dk)
AT_RISK = timedelta(minutes=190)
LATE = timedelta(minutes=250)


@dataclass
class Campus:
    organization: Organization
    reporter: Headers
    staff: Headers
    manager: Headers
    wc_id: int


@pytest.fixture
def campus(agent_client: TestClient, db_session: Session) -> Campus:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    wc = location_repository.get_by_code(db_session, organization.id, "A-1-WCE")
    assert wc is not None
    return Campus(
        organization=organization,
        reporter=bearer(agent_client, "ogrenci@kampus.example.com", PASSWORD),
        staff=bearer(agent_client, "temizlik@kampus.example.com", PASSWORD),
        manager=bearer(agent_client, "mudur.destek@kampus.example.com", PASSWORD),
        wc_id=wc.id,
    )


def _report(client: TestClient, campus: Campus) -> int:
    body = {"description": SOAP, "location_id": campus.wc_id}
    response = client.post("/api/v1/cases", json=body, headers=campus.reporter)
    assert response.status_code == 201
    return int(response.json()["id"])


def _start_work(client: TestClient, campus: Campus) -> int:
    [task] = client.get("/api/v1/tasks/mine", headers=campus.staff).json()["items"]
    for action in ("accept", "start"):
        client.post(f"/api/v1/tasks/{task['id']}/{action}", headers=campus.staff)
    return int(task["id"])


def _tick(session: Session, clock: FrozenClock, *, agents: bool = True) -> None:
    MonitoringService(session, clock, agents_enabled=agents).tick()


def _events(session: Session, case_id: int, event_type: str) -> list[CaseEvent]:
    return list(
        session.scalars(
            select(CaseEvent).where(
                CaseEvent.case_id == case_id, CaseEvent.event_type == event_type
            )
        )
    )


def _case(session: Session, case_id: int) -> Case:
    case = session.get(Case, case_id)
    assert case is not None
    session.refresh(case)
    return case


# --- SLA ----------------------------------------------------------------------------------


def test_nothing_happens_while_on_track(
    agent_client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    _start_work(agent_client, campus)
    clock.advance(timedelta(minutes=30))

    _tick(db_session, clock)

    decisions = db_session.scalars(
        select(AgentDecision).where(AgentDecision.agent_name == "monitoring")
    ).all()
    assert decisions == []
    assert _events(db_session, case_id, "SLA_WARNING") == []


def test_at_risk_case_is_warned_once(
    agent_client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    _start_work(agent_client, campus)
    clock.advance(AT_RISK)

    _tick(db_session, clock)
    _tick(db_session, clock)

    [warning] = _events(db_session, case_id, "SLA_WARNING")
    assert (warning.actor_type, warning.agent_name) == ("AGENT", "monitoring")
    decision = db_session.scalars(
        select(AgentDecision).where(
            AgentDecision.case_id == case_id, AgentDecision.agent_name == "monitoring"
        )
    ).one()
    assert decision.decision == "SLA_WARNING"


def test_breached_case_is_escalated_once_without_changing_its_status(
    agent_client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    _start_work(agent_client, campus)
    clock.advance(LATE)

    _tick(db_session, clock)
    _tick(db_session, clock)

    case = _case(db_session, case_id)
    assert (case.status, case.escalation_level) == (CaseStatus.IN_PROGRESS, 1)
    assert len(_events(db_session, case_id, "SLA_BREACHED")) == 1
    assert len(_events(db_session, case_id, "ESCALATED")) == 1
    # Asim varken gec uyari uretilmez
    assert _events(db_session, case_id, "SLA_WARNING") == []


def test_cases_already_resolved_are_not_monitored(
    agent_client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    task_id = _start_work(agent_client, campus)
    clock.advance(LATE)
    staff = bearer(agent_client, "temizlik@kampus.example.com", PASSWORD)
    agent_client.post(
        f"/api/v1/tasks/{task_id}/complete",
        json={"completion_note": "Sabunluklar dolduruldu, yedek bırakıldı."},
        headers=staff,
    )
    assert _case(db_session, case_id).status is CaseStatus.CLOSED

    _tick(db_session, clock)

    assert _events(db_session, case_id, "SLA_BREACHED") == []


# --- Kabul edilmeyen gorev ----------------------------------------------------------------


def test_unaccepted_task_gets_another_staff_recommendation_once(
    agent_client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    clock.advance(timedelta(minutes=61))

    _tick(db_session, clock)
    _tick(db_session, clock)

    [recommended] = _events(db_session, case_id, "REASSIGN_RECOMMENDED")
    other = db_session.scalars(
        select(User.id).where(User.email == "guvenlik@kampus.example.com")
    ).one()
    assert recommended.metadata_json["suggested_user_id"] == other
    assert _case(db_session, case_id).status is CaseStatus.ASSIGNED


def test_without_other_staff_there_is_no_suggestion(
    agent_client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    other = db_session.scalars(
        select(User).where(User.email == "guvenlik@kampus.example.com")
    ).one()
    other.is_active = False
    db_session.flush()
    clock.advance(timedelta(minutes=61))

    _tick(db_session, clock)

    [recommended] = _events(db_session, case_id, "REASSIGN_RECOMMENDED")
    # Su anki personel kendisine onerilmez
    assert recommended.metadata_json["suggested_user_id"] is None


def test_a_new_assignment_can_get_a_new_recommendation(
    agent_client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    clock.advance(timedelta(minutes=61))
    _tick(db_session, clock)
    clock.advance(timedelta(minutes=1))
    manager = bearer(agent_client, "mudur.destek@kampus.example.com", PASSWORD)
    case = _case(db_session, case_id)
    agent_client.post(
        f"/api/v1/cases/{case_id}/assign",
        json={"department_id": case.department_id},
        headers=manager,
    )
    db_session.expire_all()
    _case(db_session, case_id).response_due_at = clock.now() + timedelta(minutes=60)
    db_session.flush()
    clock.advance(timedelta(minutes=61))

    _tick(db_session, clock)

    assert len(_events(db_session, case_id, "REASSIGN_RECOMMENDED")) == 2


# --- Bekleyen durumlar --------------------------------------------------------------------


def test_stuck_analysis_is_rerun(
    client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    # Agent hatti kapali istemciyle olustu: ANALYZING'de kaldi (or. sunucu yeniden basladi)
    case_id = _report(client, campus)
    clock.advance(timedelta(minutes=4))
    _tick(db_session, clock)
    assert _case(db_session, case_id).status is CaseStatus.ANALYZING

    clock.advance(timedelta(minutes=2))
    _tick(db_session, clock)

    assert _case(db_session, case_id).status is CaseStatus.ASSIGNED


def test_with_agents_disabled_analysis_waits_for_the_manager(
    client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    case_id = _report(client, campus)
    clock.advance(timedelta(minutes=30))

    _tick(db_session, clock, agents=False)

    assert _case(db_session, case_id).status is CaseStatus.ANALYZING


def test_unanswered_info_request_closes_the_case_after_48_hours(
    client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus
) -> None:
    case_id = _report(client, campus)
    client.post(
        f"/api/v1/cases/{case_id}/request-info",
        json={"question": "Hangi lavabo?"},
        headers=campus.manager,
    )
    clock.advance(timedelta(hours=47))
    _tick(db_session, clock)
    assert _case(db_session, case_id).status is CaseStatus.NEEDS_INFO

    clock.advance(timedelta(hours=2))
    _tick(db_session, clock)

    assert _case(db_session, case_id).status is CaseStatus.REJECTED
    [rejected] = _events(db_session, case_id, "CASE_REJECTED")
    assert rejected.agent_name == "monitoring"


# --- Tek sunucu calistirir ----------------------------------------------------------------


def test_a_tick_is_skipped_while_another_instance_holds_the_lock(
    test_engine: Engine, db_session: Session
) -> None:
    calls: list[Session] = []
    with test_engine.connect() as other:
        other.execute(text("SELECT pg_advisory_lock(:key)"), {"key": MONITORING_LOCK_KEY})
        try:
            ran = run_locked(db_session, calls.append)
        finally:
            other.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": MONITORING_LOCK_KEY})

    assert (ran, calls) == (False, [])
    assert run_locked(db_session, calls.append) is True
    assert calls == [db_session]
