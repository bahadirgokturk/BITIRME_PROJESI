"""Agent hatti (E5-8b, docs/AGENTS.md bolum 3): bildirim gelince agent'lar calisir, Supervisor
kararini servis uygular, her karar agent_decisions'a yazilir. Gercek egitilmis model kullanilir."""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AgentDecision, Case, Organization, User
from app.repositories import location_repository
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
Headers = dict[str, str]
AGENTS_IN_ORDER = [
    "intake",
    "classification",
    "duplicate",
    "verification",
    "priority",
    "routing",
    "supervisor",
]


@dataclass
class Campus:
    organization: Organization
    reporter: Headers
    manager: Headers
    wc_id: int
    amfi_id: int


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
        manager=bearer(agent_client, "mudur.destek@kampus.example.com", PASSWORD),
        wc_id=location("A-1-WCE"),
        amfi_id=location("A-101"),
    )


def _report(client: TestClient, campus: Campus, description: str, location_id: int) -> dict:
    body = {"description": description, "location_id": location_id}
    created = client.post("/api/v1/cases", json=body, headers=campus.reporter)
    assert created.status_code == 201
    # Agent'lar yanittan sonra calisir (BackgroundTasks); guncel hali yeniden okunur
    return client.get(f"/api/v1/cases/{created.json()['id']}", headers=campus.manager).json()


def _events(client: TestClient, campus: Campus, case_id: int) -> list[str]:
    events = client.get(f"/api/v1/cases/{case_id}/events", headers=campus.manager).json()
    return [e["event_type"] for e in events]


def _user_id(session: Session, email: str) -> int:
    return session.scalars(select(User.id).where(User.email == email)).one()


def _assignee(session: Session, case_id: int) -> int | None:
    case = session.get(Case, case_id)
    assert case is not None
    session.refresh(case)
    return case.assigned_staff_id


def test_routine_report_is_assigned_to_staff_automatically(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    case = _report(agent_client, campus, "Tuvalette sabun bitmiş, sabunluklar bomboş", campus.wc_id)

    assert case["status"] == "ASSIGNED"
    assert case["case_type"]["code"] == "SOAP_EMPTY"
    assert case["department"]["code"] == "SUPPORT_SERVICES"
    assert case["priority"] == "LOW"
    assert case["needs_human_review"] is False
    assert case["due_at"] is not None  # SLA hedefi atamada yazildi
    # Destek Hizmetleri'nde iki bos personel: esitlikte ilk kaydedilen (kucuk id)
    assert _assignee(db_session, case["id"]) == _user_id(db_session, "temizlik@kampus.example.com")
    events = _events(agent_client, campus, case["id"])
    assert {"AI_CLASSIFIED", "ROUTED", "TASK_CREATED", "SUPERVISOR_DECIDED"} <= set(events)


def test_every_agent_decision_is_stored_with_one_run_id(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    case = _report(agent_client, campus, "Tuvalette sabun bitmiş, sabunluklar bomboş", campus.wc_id)

    decisions = db_session.scalars(
        select(AgentDecision).where(AgentDecision.case_id == case["id"]).order_by(AgentDecision.id)
    ).all()

    assert [d.agent_name for d in decisions] == AGENTS_IN_ORDER
    assert len({d.run_id for d in decisions}) == 1
    assert decisions[-1].decision == "AUTO_ASSIGN"


def test_sparks_are_escalated_to_the_manager(agent_client: TestClient, campus: Campus) -> None:
    case = _report(
        agent_client, campus, "Prizden kıvılcım çıkıyor, yanık kokusu var", campus.amfi_id
    )

    assert case["status"] == "ESCALATED"
    assert case["case_type"]["code"] == "ELECTRICAL_FAILURE"
    assert case["priority"] == "CRITICAL"
    assert case["needs_human_review"] is True


def test_administrative_requests_are_rejected_as_out_of_scope(
    agent_client: TestClient, campus: Campus
) -> None:
    case = _report(
        agent_client, campus, "Transkriptim hâlâ gelmedi, ne zaman gelir", campus.amfi_id
    )

    assert case["status"] == "REJECTED"
    assert "CASE_REJECTED" in _events(agent_client, campus, case["id"])


def test_unclear_type_goes_to_manager_review(agent_client: TestClient, campus: Campus) -> None:
    text = "Koridorda garip bir koku var nereden geldiği belli değil"
    case = _report(agent_client, campus, text, campus.amfi_id)

    # OTHER: gorev alan birim yok, manager inceler
    assert case["status"] == "CLASSIFIED"
    assert case["needs_human_review"] is True


def test_no_available_staff_puts_the_task_in_the_department_pool(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    technician = db_session.get(User, _user_id(db_session, "teknisyen@kampus.example.com"))
    assert technician is not None
    technician.is_active = False
    db_session.flush()

    text = "Amfide projeksiyon açılmıyor, ders başlayamıyor"
    case = _report(agent_client, campus, text, campus.amfi_id)

    assert case["status"] == "ASSIGNED"
    assert case["department"]["code"] == "MAINTENANCE"
    assert _assignee(db_session, case["id"]) is None


def test_meaningless_text_asks_the_reporter_and_the_answer_restarts_the_analysis(
    agent_client: TestClient, campus: Campus
) -> None:
    case = _report(agent_client, campus, "?? !! ... 1 2 3 ??", campus.wc_id)

    assert case["status"] == "NEEDS_INFO"
    assert case["info_request"]

    answer = {"body": "Tuvalette sabun bitmiş, sabunluklar bomboş"}
    url = f"/api/v1/cases/{case['id']}/info"
    assert agent_client.post(url, json=answer, headers=campus.reporter).status_code == 200

    again = agent_client.get(f"/api/v1/cases/{case['id']}", headers=campus.manager).json()
    assert again["status"] == "ASSIGNED"
    assert again["case_type"]["code"] == "SOAP_EMPTY"


def test_a_second_unclear_answer_goes_to_the_manager_instead_of_asking_again(
    agent_client: TestClient, campus: Campus
) -> None:
    case = _report(agent_client, campus, "?? !! ... 1 2 3 ??", campus.wc_id)
    url = f"/api/v1/cases/{case['id']}/info"
    agent_client.post(url, json={"body": "??? !!!"}, headers=campus.reporter)

    again = agent_client.get(f"/api/v1/cases/{case['id']}", headers=campus.manager).json()

    # Ayni soru tekrar tekrar sorulmaz: ikinci kez anlasilmazsa manager karar verir
    assert again["status"] == "CLASSIFIED"
    assert again["needs_human_review"] is True


def test_manager_reads_the_decisions_with_reasons(agent_client: TestClient, campus: Campus) -> None:
    case = _report(
        agent_client, campus, "Prizden kıvılcım çıkıyor, yanık kokusu var", campus.amfi_id
    )
    url = f"/api/v1/cases/{case['id']}/decisions"

    decisions = agent_client.get(url, headers=campus.manager).json()
    reporter_view = agent_client.get(url, headers=campus.reporter)

    assert [d["agent_name"] for d in decisions] == AGENTS_IN_ORDER
    assert decisions[-1]["decision"] == "ESCALATE"
    assert decisions[-1]["reasons"][0]["code"] == "RULE_3_ESCALATE"
    assert reporter_view.status_code == 403


def test_agents_can_be_switched_off(client: TestClient, db_session: Session) -> None:
    # Varsayilan test istemcisinde agent'lar kapali: bildirim ANALYZING'de manager'i bekler
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    reporter = bearer(client, "ogrenci@kampus.example.com", PASSWORD)
    wc = location_repository.get_by_code(db_session, organization.id, "A-1-WCE")
    assert wc is not None

    body = {"description": "Tuvalette sabun bitmiş, sabunluklar bomboş", "location_id": wc.id}
    created = client.post("/api/v1/cases", json=body, headers=reporter).json()

    case = client.get(f"/api/v1/cases/{created['id']}", headers=reporter).json()
    assert case["status"] == "ANALYZING"
