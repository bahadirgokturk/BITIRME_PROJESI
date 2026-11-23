"""Kanit fotografi kontrolu (AGENTS.md 4.13): personelin fotografi bildirimdeki yerden degilse is
kapanmaz, personelden dogru yerden fotograf istenir. Ayni yerse fotograf guclu kanittir.

Gercek CLIP yerine sahte kodlayici: fotografin rengi "yer" gibidir (ayni renk = ayni yer).
"""

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.vision_model import VISION_DIR, VisionModel, load_bank
from app.api.deps import get_vision_model
from app.models import AgentDecision, Case, Task
from app.models.enums import CaseStatus, TaskStatus
from app.repositories import location_repository
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
SOAP = "Tuvalette sabun bitmiş, sabunluklar bomboş"
NOTE = "Sabunluklar dolduruldu, yedek sabun bırakıldı."
GRAY = (200, 200, 200)
RED = (220, 30, 30)
EMBEDDING_SIZE = 512
Headers = dict[str, str]


class ColorEncoder:
    """Renk basina bir eksen: ayni renk benzerlik 1, farkli renk 0."""

    def __init__(self) -> None:
        self._axes: dict[tuple[int, ...], int] = {}

    def encode(self, data: bytes) -> list[float]:
        with Image.open(BytesIO(data)) as image:
            color = tuple(image.convert("RGB").getpixel((0, 0)))  # type: ignore[arg-type]
        axis = self._axes.setdefault(color, len(self._axes))
        vector = [0.0] * EMBEDDING_SIZE
        vector[axis] = 1.0
        return vector


def _jpeg(color: tuple[int, int, int]) -> bytes:
    output = BytesIO()
    Image.new("RGB", (64, 48), color).save(output, format="JPEG", quality=100)
    return output.getvalue()


@pytest.fixture
def people(agent_client: TestClient, db_session: Session) -> dict[str, Headers | int]:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    wc = location_repository.get_by_code(db_session, organization.id, "A-1-WCE")
    assert wc is not None
    model = VisionModel(encoder=ColorEncoder(), bank=load_bank(VISION_DIR))
    agent_client.app.dependency_overrides[get_vision_model] = lambda: model  # type: ignore[attr-defined]
    return {
        "reporter": bearer(agent_client, "ogrenci@kampus.example.com", PASSWORD),
        "staff": bearer(agent_client, "temizlik@kampus.example.com", PASSWORD),
        "manager": bearer(agent_client, "mudur.destek@kampus.example.com", PASSWORD),
        "wc": wc.id,
    }


def _upload(
    client: TestClient, case_id: int, color: tuple[int, int, int], headers: Headers
) -> None:
    files = {"file": ("foto.jpg", _jpeg(color), "image/jpeg")}
    response = client.post(f"/api/v1/cases/{case_id}/attachments", files=files, headers=headers)
    assert response.status_code == 201, response.text


def _work_with_evidence(
    client: TestClient, people: dict, report_photo: bool, evidence: tuple[int, int, int]
) -> tuple[int, int]:
    body = {"description": SOAP, "location_id": people["wc"]}
    case_id = int(client.post("/api/v1/cases", json=body, headers=people["reporter"]).json()["id"])
    if report_photo:
        _upload(client, case_id, GRAY, people["reporter"])
    [task] = client.get("/api/v1/tasks/mine", headers=people["staff"]).json()["items"]
    for action in ("accept", "start"):
        client.post(f"/api/v1/tasks/{task['id']}/{action}", json={}, headers=people["staff"])
    _upload(client, case_id, evidence, people["staff"])
    done = client.post(
        f"/api/v1/tasks/{task['id']}/complete",
        json={"completion_note": NOTE},
        headers=people["staff"],
    )
    assert done.status_code == 200, done.text
    return case_id, int(task["id"])


def _state(session: Session, case_id: int, task_id: int) -> tuple[CaseStatus, TaskStatus]:
    case, task = session.get(Case, case_id), session.get(Task, task_id)
    assert case is not None and task is not None
    session.refresh(case)
    session.refresh(task)
    return case.status, task.status


def _checks(session: Session, case_id: int) -> list[str]:
    return list(
        session.scalars(
            select(AgentDecision.decision).where(
                AgentDecision.case_id == case_id, AgentDecision.agent_name == "evidence_check"
            )
        )
    )


def test_evidence_from_the_reported_place_closes_the_case(
    agent_client: TestClient, db_session: Session, people: dict
) -> None:
    case_id, task_id = _work_with_evidence(agent_client, people, report_photo=True, evidence=GRAY)

    assert _checks(db_session, case_id) == ["SAME_PLACE"]
    assert _state(db_session, case_id, task_id) == (CaseStatus.CLOSED, TaskStatus.COMPLETED)


def test_evidence_from_another_place_sends_the_work_back(
    agent_client: TestClient, db_session: Session, people: dict
) -> None:
    case_id, task_id = _work_with_evidence(agent_client, people, report_photo=True, evidence=RED)

    assert _checks(db_session, case_id) == ["DIFFERENT_PLACE"]
    assert _state(db_session, case_id, task_id) == (CaseStatus.IN_PROGRESS, TaskStatus.IN_PROGRESS)
    decisions = agent_client.get(
        f"/api/v1/cases/{case_id}/decisions", headers=people["manager"]
    ).json()
    check = next(d for d in decisions if d["agent_name"] == "evidence_check")
    assert check["agent_label"] == "Kanıt kontrolü"
    assert check["decision_label"] == "Kanıt fotoğrafı başka yerden"


def test_without_a_report_photo_the_evidence_counts_as_before(
    agent_client: TestClient, db_session: Session, people: dict
) -> None:
    case_id, task_id = _work_with_evidence(agent_client, people, report_photo=False, evidence=RED)

    assert _checks(db_session, case_id) == ["NO_REFERENCE"]
    assert _state(db_session, case_id, task_id) == (CaseStatus.CLOSED, TaskStatus.COMPLETED)
