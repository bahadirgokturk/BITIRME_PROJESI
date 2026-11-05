"""Gorev tamamlaninca dogrulama (E5-11, docs/AGENTS.md 4.9): Resolution Agent isi kapatir,
personelden kanit ister ya da yapilamamis isi manager'a iletir. Agent hatti kapaliysa manager
kapatir."""

from dataclasses import dataclass
from datetime import timedelta
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AgentDecision, Case, DecisionFeedback, Organization
from app.repositories import location_repository
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.conftest import FrozenClock
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
Headers = dict[str, str]
QUEUE = "/api/v1/manager/review-queue"
SOAP = "Tuvalette sabun bitmiş, sabunluklar bomboş"
GOOD_NOTE = "Sabunluklar dolduruldu, yedek sabun bırakıldı."
WORK = timedelta(minutes=15)


@dataclass
class Campus:
    organization: Organization
    reporter: Headers
    staff: Headers
    manager: Headers
    wc_id: int


@dataclass
class Job:
    case_id: int
    task_id: int


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


@pytest.fixture
def job(agent_client: TestClient, campus: Campus) -> Job:
    """Agent'in otomatik atadigi bildirim; personel kabul edip basladi."""
    body = {"description": SOAP, "location_id": campus.wc_id}
    case_id = agent_client.post("/api/v1/cases", json=body, headers=campus.reporter).json()["id"]
    [task] = agent_client.get("/api/v1/tasks/mine", headers=campus.staff).json()["items"]
    for action in ("accept", "start"):
        agent_client.post(f"/api/v1/tasks/{task['id']}/{action}", headers=campus.staff)
    return Job(case_id=case_id, task_id=task["id"])


def _complete(client: TestClient, campus: Campus, job: Job, note: str | None) -> None:
    response = client.post(
        f"/api/v1/tasks/{job.task_id}/complete",
        json={"completion_note": note},
        headers=campus.staff,
    )
    assert response.status_code == 200


def _photo(client: TestClient, headers: Headers, job: Job) -> None:
    buffer = BytesIO()
    Image.new("RGB", (6, 6), "blue").save(buffer, format="PNG")
    files = {"file": ("kanit.png", buffer.getvalue(), "image/png")}
    response = client.post(f"/api/v1/cases/{job.case_id}/attachments", files=files, headers=headers)
    assert response.status_code == 201


def _case(client: TestClient, campus: Campus, job: Job) -> dict:
    return client.get(f"/api/v1/cases/{job.case_id}", headers=campus.manager).json()


def _task(client: TestClient, campus: Campus, job: Job) -> dict:
    return client.get(f"/api/v1/tasks/{job.task_id}", headers=campus.staff).json()


def _events(client: TestClient, campus: Campus, job: Job) -> list[dict]:
    return client.get(f"/api/v1/cases/{job.case_id}/events", headers=campus.manager).json()


def _close(client: TestClient, headers: Headers, case_id: int) -> object:
    return client.post(
        f"/api/v1/cases/{case_id}/close", json={"reason": "Yerinde kontrol ettim."}, headers=headers
    )


# --- Agent karari -------------------------------------------------------------------------


def test_explained_work_is_verified_and_closed(
    agent_client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus, job: Job
) -> None:
    clock.advance(WORK)

    _complete(agent_client, campus, job, GOOD_NOTE)

    assert _case(agent_client, campus, job)["status"] == "CLOSED"
    types = [e["event_type"] for e in _events(agent_client, campus, job)]
    assert types[-3:] == ["WORK_COMPLETED", "RESOLUTION_EVALUATED", "CASE_CLOSED"]
    decision = db_session.scalars(
        select(AgentDecision).where(
            AgentDecision.case_id == job.case_id, AgentDecision.agent_name == "resolution"
        )
    ).one()
    assert decision.decision == "RESOLVED"
    assert decision.input_snapshot["work_minutes"] == 15


def test_without_evidence_the_task_goes_back_to_the_staff(
    agent_client: TestClient, clock: FrozenClock, campus: Campus, job: Job
) -> None:
    _complete(agent_client, campus, job, "tamam")

    case = _case(agent_client, campus, job)
    task = _task(agent_client, campus, job)
    assert (case["status"], task["status"], task["completed_at"]) == (
        "IN_PROGRESS",
        "IN_PROGRESS",
        None,
    )
    evaluated, requested = _events(agent_client, campus, job)[-2:]
    assert evaluated["event_type"] == "RESOLUTION_EVALUATED"
    assert evaluated["metadata"]["decision"] == "NEEDS_MORE_EVIDENCE"
    # Personele ne eksik oldugu soylenir
    assert requested["event_type"] == "EVIDENCE_REQUESTED"
    assert "fotoğraf" in requested["metadata"]["message"]


def test_staff_adds_a_photo_and_the_case_closes(
    agent_client: TestClient, campus: Campus, job: Job
) -> None:
    _complete(agent_client, campus, job, "tamam")
    _photo(agent_client, campus.staff, job)

    _complete(agent_client, campus, job, "tamam")

    assert _case(agent_client, campus, job)["status"] == "CLOSED"


def test_evidence_is_asked_once_then_the_manager_decides(
    agent_client: TestClient, db_session: Session, campus: Campus, job: Job
) -> None:
    _complete(agent_client, campus, job, "tamam")
    _complete(agent_client, campus, job, "bitti")

    case = _case(agent_client, campus, job)
    assert (case["status"], case["needs_human_review"]) == ("VERIFICATION", True)
    [item] = agent_client.get(QUEUE, headers=campus.manager).json()["items"]
    assert item["reason_code"] == "NOTE_TOO_SHORT"

    closed = _close(agent_client, campus.manager, job.case_id)

    assert closed.json()["status"] == "CLOSED"
    assert closed.json()["needs_human_review"] is False
    feedback = db_session.scalars(
        select(DecisionFeedback).where(DecisionFeedback.case_id == job.case_id)
    ).one()
    decision = db_session.get(AgentDecision, feedback.decision_id)
    assert decision is not None and decision.agent_name == "resolution"
    assert (feedback.field, feedback.original_value, feedback.corrected_value) == (
        "resolution",
        "NEEDS_MORE_EVIDENCE",
        "RESOLVED",
    )


def test_work_that_could_not_be_done_goes_to_the_manager(
    agent_client: TestClient, db_session: Session, clock: FrozenClock, campus: Campus, job: Job
) -> None:
    clock.advance(WORK)

    _complete(agent_client, campus, job, "Sabunluk kırık, parça yok.")

    case = _case(agent_client, campus, job)
    assert (case["status"], case["reopened_count"]) == ("ESCALATED", 1)
    # Is personelden alindi: manager yeniden atar
    stored = db_session.get(Case, job.case_id)
    assert stored is not None
    db_session.refresh(stored)
    assert stored.assigned_staff_id is None
    [item] = agent_client.get(QUEUE, headers=campus.manager).json()["items"]
    assert item["reason_code"] == "NOT_DONE"


def test_a_photo_makes_quick_work_believable(
    agent_client: TestClient, campus: Campus, job: Job
) -> None:
    _photo(agent_client, campus.staff, job)

    _complete(agent_client, campus, job, None)

    assert _case(agent_client, campus, job)["status"] == "CLOSED"


@pytest.mark.parametrize("uploader", ["reporter", "colleague"])
def test_only_the_assignees_photo_is_evidence(
    agent_client: TestClient, campus: Campus, job: Job, uploader: str
) -> None:
    # Ayni birimde baska bir personel (orn. onceki atanan) fotograf eklemis
    colleague = bearer(agent_client, "guvenlik@kampus.example.com", PASSWORD)
    _photo(agent_client, colleague if uploader == "colleague" else campus.reporter, job)

    _complete(agent_client, campus, job, None)

    assert _case(agent_client, campus, job)["status"] == "IN_PROGRESS"


# --- Manager kapatir ----------------------------------------------------------------------


def test_only_cases_waiting_for_verification_can_be_closed(
    agent_client: TestClient, campus: Campus, job: Job
) -> None:
    assert _close(agent_client, campus.manager, job.case_id).status_code == 409


@pytest.mark.parametrize("who", ["reporter", "staff"])
def test_only_managers_close(agent_client: TestClient, campus: Campus, job: Job, who: str) -> None:
    _complete(agent_client, campus, job, "tamam")
    _complete(agent_client, campus, job, "bitti")

    assert _close(agent_client, getattr(campus, who), job.case_id).status_code == 403
