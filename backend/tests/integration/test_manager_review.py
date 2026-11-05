"""Manager inceleme kuyrugu, agent kararini duzeltme (override) ve reddetme (E5-9).

Duzeltme decision_feedback'e ilgili agent kararina bagli yazilir: modelin yeniden egitimi icin
etiketli veri ve tezdeki "override rate" metriginin kaynagi (docs/ANALYTICS.md).
"""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AgentDecision, DecisionFeedback, Organization
from app.repositories import department_repository, location_repository
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
Headers = dict[str, str]
QUEUE = "/api/v1/manager/review-queue"
SPARKS = "Prizden kıvılcım çıkıyor, yanık kokusu var"
STRANGE_SMELL = "Koridorda garip bir koku var nereden geldiği belli değil"
SOAP = "Tuvalette sabun bitmiş, sabunluklar bomboş"


@dataclass
class Campus:
    organization: Organization
    reporter: Headers
    staff: Headers
    manager: Headers
    corridor_id: int
    wc_id: int


@pytest.fixture
def campus(agent_client: TestClient, db_session: Session) -> Campus:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)

    def location(code: str) -> int:
        found = location_repository.get_by_code(db_session, organization.id, code)
        assert found is not None
        return found.id

    return Campus(
        organization=organization,
        reporter=bearer(agent_client, "ogrenci@kampus.example.com", PASSWORD),
        staff=bearer(agent_client, "temizlik@kampus.example.com", PASSWORD),
        manager=bearer(agent_client, "mudur.destek@kampus.example.com", PASSWORD),
        corridor_id=location("A-Z-KOR"),
        wc_id=location("A-1-WCE"),
    )


def _report(client: TestClient, campus: Campus, text: str, location_id: int) -> int:
    body = {"description": text, "location_id": location_id}
    response = client.post("/api/v1/cases", json=body, headers=campus.reporter)
    assert response.status_code == 201
    return int(response.json()["id"])


def _case(client: TestClient, campus: Campus, case_id: int) -> dict:
    return client.get(f"/api/v1/cases/{case_id}", headers=campus.manager).json()


def _override(client: TestClient, campus: Campus, case_id: int, **body: str) -> object:
    return client.post(f"/api/v1/cases/{case_id}/override", json=body, headers=campus.manager)


def _department_id(session: Session, campus: Campus, code: str) -> int:
    department = department_repository.get_by_code(session, campus.organization.id, code)
    assert department is not None
    return department.id


# --- Kuyruk ------------------------------------------------------------------------------


def test_queue_shows_cases_waiting_for_a_human_with_the_reason(
    agent_client: TestClient, campus: Campus
) -> None:
    review = _report(agent_client, campus, STRANGE_SMELL, campus.corridor_id)
    escalated = _report(agent_client, campus, SPARKS, campus.corridor_id)
    _report(agent_client, campus, SOAP, campus.wc_id)  # otomatik atandi: kuyrukta yok

    items = agent_client.get(QUEUE, headers=campus.manager).json()["items"]

    # En kritik once: kivilcim (CRITICAL) koku (MEDIUM) bildiriminden once
    assert [item["case"]["id"] for item in items] == [escalated, review]
    assert items[0]["reason_code"] == "RULE_3_ESCALATE"
    assert items[1]["reason_code"] == "RULE_5_SEND_TO_HUMAN_REVIEW"
    assert items[1]["reason"]
    assert 0 < items[1]["confidence"] <= 1


@pytest.mark.parametrize("who", ["reporter", "staff"])
def test_only_managers_see_the_queue(agent_client: TestClient, campus: Campus, who: str) -> None:
    assert agent_client.get(QUEUE, headers=getattr(campus, who)).status_code == 403


# --- Duzeltme ----------------------------------------------------------------------------


def test_correcting_the_case_type_is_recorded_as_feedback(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    case_id = _report(agent_client, campus, STRANGE_SMELL, campus.corridor_id)

    response = _override(
        agent_client,
        campus,
        case_id,
        field="case_type",
        corrected_value="AREA_DIRTY",
        reason="Koku temizlik eksikliğinden; alan kirli.",
    )

    assert response.status_code == 200
    assert response.json()["case_type"]["code"] == "AREA_DIRTY"
    assert response.json()["category"] == "CLEANING"
    feedback = db_session.scalars(
        select(DecisionFeedback).where(DecisionFeedback.case_id == case_id)
    ).one()
    decision = db_session.get(AgentDecision, feedback.decision_id)
    assert decision is not None and decision.agent_name == "classification"
    assert (feedback.field, feedback.original_value, feedback.corrected_value) == (
        "case_type",
        "OTHER",
        "AREA_DIRTY",
    )
    events = agent_client.get(f"/api/v1/cases/{case_id}/events", headers=campus.manager).json()
    assert events[-1]["event_type"] == "DECISION_OVERRIDDEN"


def test_reporter_does_not_see_the_correction(agent_client: TestClient, campus: Campus) -> None:
    case_id = _report(agent_client, campus, SPARKS, campus.corridor_id)
    _override(agent_client, campus, case_id, field="priority", corrected_value="HIGH", reason="x")

    events = agent_client.get(f"/api/v1/cases/{case_id}/events", headers=campus.reporter).json()

    assert "DECISION_OVERRIDDEN" not in [e["event_type"] for e in events]


def test_priority_and_department_can_be_corrected(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    case_id = _report(agent_client, campus, SPARKS, campus.corridor_id)

    _override(agent_client, campus, case_id, field="priority", corrected_value="HIGH", reason="r")
    _override(
        agent_client,
        campus,
        case_id,
        field="department",
        corrected_value="SUPPORT_SERVICES",
        reason="r",
    )

    case = _case(agent_client, campus, case_id)
    assert (case["priority"], case["department"]["code"]) == ("HIGH", "SUPPORT_SERVICES")
    agents = {
        db_session.get(AgentDecision, f.decision_id).agent_name  # type: ignore[union-attr]
        for f in db_session.scalars(select(DecisionFeedback)).all()
    }
    assert agents == {"priority", "routing"}


@pytest.mark.parametrize(
    "body",
    [
        {"field": "priority", "corrected_value": "SUPER", "reason": "r"},
        {"field": "case_type", "corrected_value": "NOT_A_TYPE", "reason": "r"},
        {"field": "department", "corrected_value": "NOWHERE", "reason": "r"},
        {"field": "case_type", "corrected_value": "AREA_DIRTY", "reason": "  "},
        {"field": "colour", "corrected_value": "red", "reason": "r"},
    ],
)
def test_invalid_corrections_are_rejected(
    agent_client: TestClient, campus: Campus, body: dict[str, str]
) -> None:
    case_id = _report(agent_client, campus, STRANGE_SMELL, campus.corridor_id)

    assert _override(agent_client, campus, case_id, **body).status_code == 422


def test_only_managers_correct(agent_client: TestClient, campus: Campus) -> None:
    case_id = _report(agent_client, campus, STRANGE_SMELL, campus.corridor_id)
    body = {"field": "priority", "corrected_value": "LOW", "reason": "r"}

    response = agent_client.post(
        f"/api/v1/cases/{case_id}/override", json=body, headers=campus.staff
    )

    assert response.status_code == 403


# --- Karar: onayla (ata) ya da reddet -----------------------------------------------------


def test_assigning_a_reviewed_case_takes_it_out_of_the_queue(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    case_id = _report(agent_client, campus, STRANGE_SMELL, campus.corridor_id)
    support = _department_id(db_session, campus, "SUPPORT_SERVICES")

    assigned = agent_client.post(
        f"/api/v1/cases/{case_id}/assign", json={"department_id": support}, headers=campus.manager
    )

    assert assigned.json()["needs_human_review"] is False
    assert agent_client.get(QUEUE, headers=campus.manager).json()["items"] == []


def test_manager_rejects_an_invalid_report(agent_client: TestClient, campus: Campus) -> None:
    case_id = _report(agent_client, campus, STRANGE_SMELL, campus.corridor_id)

    response = agent_client.post(
        f"/api/v1/cases/{case_id}/reject",
        json={"reason": "Şaka amaçlı bildirim."},
        headers=campus.manager,
    )

    assert response.json()["status"] == "REJECTED"
    assert response.json()["needs_human_review"] is False
    assert agent_client.get(QUEUE, headers=campus.manager).json()["items"] == []


def test_assigned_case_cannot_be_rejected(agent_client: TestClient, campus: Campus) -> None:
    case_id = _report(agent_client, campus, SOAP, campus.wc_id)

    response = agent_client.post(
        f"/api/v1/cases/{case_id}/reject", json={"reason": "r"}, headers=campus.manager
    )

    assert response.status_code == 409
