"""Reddedilen gorev (docs/AGENTS.md 4.6, WORKFLOW.md): agent hatti aciksa Routing Agent bildirimi
reddedenler disindaki en uygun personele yeniden atar; ikinci retten sonra manager karar verir."""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AgentDecision, Case, User
from app.repositories import location_repository
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
Headers = dict[str, str]
SOAP = "Tuvalette sabun bitmiş, sabunluklar bomboş"


@dataclass
class Campus:
    reporter: Headers
    manager: Headers
    cleaner: Headers
    guard: Headers
    wc_id: int


@pytest.fixture
def campus(agent_client: TestClient, db_session: Session) -> Campus:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    wc = location_repository.get_by_code(db_session, organization.id, "A-1-WCE")
    assert wc is not None

    def login(email: str) -> Headers:
        return bearer(agent_client, f"{email}@kampus.example.com", PASSWORD)

    return Campus(
        reporter=login("ogrenci"),
        manager=login("mudur.destek"),
        cleaner=login("temizlik"),
        guard=login("guvenlik"),
        wc_id=wc.id,
    )


def _user_id(session: Session, name: str) -> int:
    email = f"{name}@kampus.example.com"
    return session.scalars(select(User.id).where(User.email == email)).one()


def _report(client: TestClient, campus: Campus) -> int:
    body = {"description": SOAP, "location_id": campus.wc_id}
    created = client.post("/api/v1/cases", json=body, headers=campus.reporter)
    assert created.status_code == 201
    case_id: int = created.json()["id"]
    return case_id


def _decline(client: TestClient, headers: Headers) -> None:
    [task] = client.get("/api/v1/tasks/mine", headers=headers).json()["items"]
    url = f"/api/v1/tasks/{task['id']}/decline"
    assert client.post(url, json={"reason": "Yetkim dışında."}, headers=headers).status_code == 200


def _case(client: TestClient, campus: Campus, case_id: int) -> dict:
    return client.get(f"/api/v1/cases/{case_id}", headers=campus.manager).json()


def _assignee(session: Session, case_id: int) -> int | None:
    case = session.get(Case, case_id)
    assert case is not None
    session.refresh(case)
    return case.assigned_staff_id


def _routing_decisions(session: Session, case_id: int) -> list[AgentDecision]:
    return list(
        session.scalars(
            select(AgentDecision)
            .where(AgentDecision.case_id == case_id, AgentDecision.agent_name == "routing")
            .order_by(AgentDecision.id)
        )
    )


def test_declined_task_is_rerouted_to_another_staff(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    assert _assignee(db_session, case_id) == _user_id(db_session, "temizlik")

    _decline(agent_client, campus.cleaner)

    case = _case(agent_client, campus, case_id)
    assert case["status"] == "ASSIGNED"
    assert case["needs_human_review"] is False
    assert _assignee(db_session, case_id) == _user_id(db_session, "guvenlik")
    [task] = agent_client.get("/api/v1/tasks/mine", headers=campus.guard).json()["items"]
    assert task["case_id"] == case_id
    assert agent_client.get("/api/v1/tasks/mine", headers=campus.cleaner).json()["items"] == []
    # Yeni yonlendirme karari kaydedilir; reddeden aday listesinde yoktur
    reroute = _routing_decisions(db_session, case_id)[-1]
    assert reroute.decision == "ASSIGN_STAFF"
    staff = [s["user_id"] for s in reroute.input_snapshot["staff"]]
    assert _user_id(db_session, "temizlik") not in staff
    events = agent_client.get(f"/api/v1/cases/{case_id}/events", headers=campus.manager).json()
    assert [e["event_type"] for e in events][-3:] == ["TASK_DECLINED", "ROUTED", "TASK_CREATED"]
    assert events[-3]["to_status"] == "ESCALATED"
    assert events[-1]["metadata"]["reroute"] is True


def test_second_decline_goes_to_the_manager(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    _decline(agent_client, campus.cleaner)

    _decline(agent_client, campus.guard)

    assert _case(agent_client, campus, case_id)["status"] == "ESCALATED"
    assert _assignee(db_session, case_id) is None
    # Ikinci retten sonra agent yeniden denemez: yonlendirme karari iki tane (ilk + bir yeniden)
    assert len(_routing_decisions(db_session, case_id)) == 2


def test_nobody_else_available_goes_to_the_manager(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    case_id = _report(agent_client, campus)
    guard = db_session.get(User, _user_id(db_session, "guvenlik"))
    assert guard is not None
    guard.is_active = False
    db_session.flush()

    _decline(agent_client, campus.cleaner)

    assert _case(agent_client, campus, case_id)["status"] == "ESCALATED"
    # Havuza dusurmek reddedene geri vermek olurdu: manager karar verir
    assert _routing_decisions(db_session, case_id)[-1].decision == "ROUTE_TO_POOL"
    assert _assignee(db_session, case_id) is None
