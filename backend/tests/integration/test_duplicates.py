"""Tekrar eden bildirimler (E5-6, docs/AGENTS.md 4.3): ayni sorunu bildiren ikinci kisi yeni gorev
olusturmaz; bildirimi mevcut bildirime baglanir (MERGED). Emin olunamazsa manager karar verir."""

from dataclasses import dataclass
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AgentDecision, Case, DecisionFeedback, Organization, Task
from app.models.enums import CaseStatus
from app.repositories import location_repository
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.conftest import FrozenClock
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
Headers = dict[str, str]
QUEUE = "/api/v1/manager/review-queue"
SOAP = "Tuvalette sabun bitmiş, sabunluklar bomboş"
SOAP_SHORT = "Sabun bitmiş"
SOAP_OTHER_WORDS = "Erkek tuvaletinde sabun yok"
TRASH = "Tuvalette çöp kutusu dolmuş, taşıyor"


@dataclass
class Campus:
    organization: Organization
    reporter: Headers
    other_reporter: Headers
    staff: Headers
    manager: Headers
    wc_id: int
    other_building_wc_id: int


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
        other_reporter=bearer(agent_client, "akademisyen@kampus.example.com", PASSWORD),
        staff=bearer(agent_client, "temizlik@kampus.example.com", PASSWORD),
        manager=bearer(agent_client, "mudur.destek@kampus.example.com", PASSWORD),
        wc_id=location("A-1-WCE"),
        other_building_wc_id=location("B-Z-WC"),
    )


def _report(client: TestClient, headers: Headers, text: str, location_id: int) -> dict[str, object]:
    body = {"description": text, "location_id": location_id}
    created = client.post("/api/v1/cases", json=body, headers=headers)
    assert created.status_code == 201
    return client.get(f"/api/v1/cases/{created.json()['id']}", headers=headers).json()


def _first_and_second(client: TestClient, campus: Campus, second: str) -> tuple[dict, dict]:
    first = _report(client, campus.reporter, SOAP, campus.wc_id)
    return first, _report(client, campus.other_reporter, second, campus.wc_id)


def _case(session: Session, case_id: object) -> Case:
    case = session.get(Case, case_id)
    assert case is not None
    session.refresh(case)
    return case


def _events(client: TestClient, campus: Campus, case_id: object) -> list[str]:
    events = client.get(f"/api/v1/cases/{case_id}/events", headers=campus.manager).json()
    return [e["event_type"] for e in events]


def _merge(client: TestClient, campus: Campus, case_id: object, parent_id: object) -> object:
    return client.post(
        f"/api/v1/cases/{case_id}/merge",
        json={"parent_case_id": parent_id, "reason": "Aynı sabunluk."},
        headers=campus.manager,
    )


# --- Otomatik birlestirme -----------------------------------------------------------------


def test_same_problem_reported_again_is_merged_into_the_first_report(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    first, second = _first_and_second(agent_client, campus, SOAP_SHORT)

    assert second["status"] == "MERGED"
    assert second["parent_case_id"] == first["id"]
    assert _case(db_session, first["id"]).duplicate_count == 1
    # Ikinci bildirim icin gorev acilmadi
    tasks = db_session.scalars(select(Task).where(Task.case_id == second["id"])).all()
    assert tasks == []
    assert "CASE_MERGED" in _events(agent_client, campus, second["id"])
    assert "CASE_MERGED" in _events(agent_client, campus, first["id"])


def test_the_reporter_sees_their_report_was_merged(
    agent_client: TestClient, campus: Campus
) -> None:
    first, second = _first_and_second(agent_client, campus, SOAP_SHORT)

    events = agent_client.get(
        f"/api/v1/cases/{second['id']}/events", headers=campus.other_reporter
    ).json()

    # Adim gorunur; ayrinti (skor, ana bildirim) olay kaydinda gizli, bildirimin kendisinde var
    assert "CASE_MERGED" in [e["event_type"] for e in events]
    assert (second["status"], second["parent_case_id"]) == ("MERGED", first["id"])


def test_duplicate_decision_is_recorded_before_verification(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    first, second = _first_and_second(agent_client, campus, SOAP_SHORT)

    decision = db_session.scalars(
        select(AgentDecision).where(
            AgentDecision.case_id == second["id"], AgentDecision.agent_name == "duplicate"
        )
    ).one()
    assert decision.decision == "DUPLICATE"
    assert decision.output_json["possible_parent_case_id"] == first["id"]


@pytest.mark.parametrize(
    ("text", "other_building"),
    [(TRASH, False), (SOAP_SHORT, True)],
    ids=["another-problem-same-place", "same-problem-another-building"],
)
def test_different_problems_are_not_merged(
    agent_client: TestClient, campus: Campus, text: str, other_building: bool
) -> None:
    _report(agent_client, campus.reporter, SOAP, campus.wc_id)
    location = campus.other_building_wc_id if other_building else campus.wc_id

    second = _report(agent_client, campus.other_reporter, text, location)

    assert second["status"] == "ASSIGNED"
    assert second["parent_case_id"] is None


def test_reports_older_than_a_day_are_not_candidates(
    agent_client: TestClient, clock: FrozenClock, campus: Campus
) -> None:
    _report(agent_client, campus.reporter, SOAP, campus.wc_id)
    clock.advance(timedelta(hours=25))
    # Erisim belirtecinin suresi doldu: yeniden giris
    again = bearer(agent_client, "akademisyen@kampus.example.com", PASSWORD)

    second = _report(agent_client, again, SOAP_SHORT, campus.wc_id)

    # Yeni sorun: inceleme bile gerekmez, dogrudan atanir
    assert second["status"] == "ASSIGNED"


def test_closed_problems_are_not_candidates(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    first = _report(agent_client, campus.reporter, SOAP, campus.wc_id)
    # Kisa yol: atanmis bildirim API ile reddedilemez, kapali bir sorun yerine gecer
    _case(db_session, first["id"]).status = CaseStatus.REJECTED
    db_session.flush()

    second = _report(agent_client, campus.other_reporter, SOAP_SHORT, campus.wc_id)

    # Yeni sorun: inceleme bile gerekmez, dogrudan atanir
    assert second["status"] == "ASSIGNED"


# --- Olasi tekrar: manager karar verir ----------------------------------------------------


def test_possible_duplicate_goes_to_review_with_the_suspected_original(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    first, second = _first_and_second(agent_client, campus, SOAP_OTHER_WORDS)

    assert second["status"] == "CLASSIFIED"
    assert second["needs_human_review"] is True
    item = agent_client.get(QUEUE, headers=campus.manager).json()["items"][0]
    assert item["case"]["id"] == second["id"]
    assert item["possible_duplicate_of"]["case_number"] == first["case_number"]
    # Benzer bildirim Verification sinyali olarak kullanildi
    verification = db_session.scalars(
        select(AgentDecision).where(
            AgentDecision.case_id == second["id"], AgentDecision.agent_name == "verification"
        )
    ).one()
    assert verification.input_snapshot["duplicate_count"] == 1


def test_manager_merges_a_possible_duplicate_and_it_is_recorded_as_feedback(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    first, second = _first_and_second(agent_client, campus, SOAP_OTHER_WORDS)

    response = _merge(agent_client, campus, second["id"], first["id"])

    assert response.status_code == 200
    assert response.json()["status"] == "MERGED"
    assert response.json()["parent_case_id"] == first["id"]
    assert response.json()["needs_human_review"] is False
    assert _case(db_session, first["id"]).duplicate_count == 1
    assert agent_client.get(QUEUE, headers=campus.manager).json()["items"] == []
    feedback = db_session.scalars(
        select(DecisionFeedback).where(DecisionFeedback.case_id == second["id"])
    ).one()
    decision = db_session.get(AgentDecision, feedback.decision_id)
    assert decision is not None and decision.agent_name == "duplicate"
    assert (feedback.field, feedback.original_value, feedback.corrected_value) == (
        "duplicate",
        first["case_number"],
        first["case_number"],
    )


def test_merged_reports_carry_their_own_duplicates_to_the_new_parent(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    first, second = _first_and_second(agent_client, campus, SOAP_OTHER_WORDS)
    _case(db_session, second["id"]).duplicate_count = 2
    db_session.flush()

    _merge(agent_client, campus, second["id"], first["id"])

    assert _case(db_session, first["id"]).duplicate_count == 3


@pytest.mark.parametrize("target", ["self", "rejected", "missing"])
def test_invalid_merge_targets_are_refused(
    agent_client: TestClient, db_session: Session, campus: Campus, target: str
) -> None:
    first, second = _first_and_second(agent_client, campus, SOAP_OTHER_WORDS)
    _case(db_session, first["id"]).status = CaseStatus.REJECTED
    db_session.flush()
    parent = {"self": second["id"], "rejected": first["id"], "missing": 999_999}[target]

    response = _merge(agent_client, campus, second["id"], parent)

    assert response.status_code == (404 if target == "missing" else 409)
    assert _case(db_session, second["id"]).status == "CLASSIFIED"


def test_an_assigned_case_cannot_be_merged(agent_client: TestClient, campus: Campus) -> None:
    first = _report(agent_client, campus.reporter, SOAP, campus.wc_id)
    other = _report(agent_client, campus.other_reporter, TRASH, campus.wc_id)

    assert _merge(agent_client, campus, other["id"], first["id"]).status_code == 409


@pytest.mark.parametrize("who", ["reporter", "staff"])
def test_only_managers_merge(agent_client: TestClient, campus: Campus, who: str) -> None:
    first, second = _first_and_second(agent_client, campus, SOAP_OTHER_WORDS)

    response = agent_client.post(
        f"/api/v1/cases/{second['id']}/merge",
        json={"parent_case_id": first["id"], "reason": "r"},
        headers=getattr(campus, who),
    )

    assert response.status_code == 403
