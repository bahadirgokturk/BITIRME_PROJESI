"""Fotograf-metin kontrolu: bildirim fotografi yuklenince gorunu modeli turu tahmin eder ve
metinden cikan turle karsilastirir; karar manager panelinde "Fotograf kontrolu" olarak gorunur.

Gercek CLIP yerine sahte kodlayici (test_photo_suggest ile ayni yaklasim).
"""

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.vision_model import VISION_DIR, VisionModel, load_bank
from app.api.deps import get_vision_model
from app.models import AgentDecision, Case
from app.models.enums import CaseStatus
from app.repositories import location_repository
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
SOAP = "Tuvalette sabun bitmiş, sabunluklar bomboş"
Headers = dict[str, str]


class FakeEncoder:
    def __init__(self, code: str) -> None:
        bank = load_bank(VISION_DIR)
        self._vector = bank.embeddings[bank.labels.index(code)].tolist()

    def encode(self, data: bytes) -> list[float]:
        return self._vector


def _photo_looks_like(client: TestClient, code: str | None) -> None:
    model = VisionModel(encoder=FakeEncoder(code), bank=load_bank(VISION_DIR)) if code else None
    client.app.dependency_overrides[get_vision_model] = lambda: model  # type: ignore[attr-defined]


def _jpeg() -> bytes:
    output = BytesIO()
    Image.new("RGB", (64, 48), (230, 230, 230)).save(output, format="JPEG")
    return output.getvalue()


@pytest.fixture
def reporter(agent_client: TestClient, db_session: Session) -> tuple[Headers, int]:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    wc = location_repository.get_by_code(db_session, organization.id, "A-1-WCE")
    assert wc is not None
    return bearer(agent_client, "ogrenci@kampus.example.com", PASSWORD), wc.id


def _report_with_photo(client: TestClient, reporter: tuple[Headers, int]) -> int:
    headers, location_id = reporter
    body = {"description": SOAP, "location_id": location_id}
    case_id = int(client.post("/api/v1/cases", json=body, headers=headers).json()["id"])
    files = {"file": ("sabunluk.jpg", _jpeg(), "image/jpeg")}
    response = client.post(f"/api/v1/cases/{case_id}/attachments", files=files, headers=headers)
    assert response.status_code == 201, response.text
    return case_id


def _checks(session: Session, case_id: int) -> list[AgentDecision]:
    return list(
        session.scalars(
            select(AgentDecision).where(
                AgentDecision.case_id == case_id, AgentDecision.agent_name == "photo_check"
            )
        )
    )


def test_matching_photo_is_recorded_as_agreeing(
    agent_client: TestClient, db_session: Session, reporter: tuple[Headers, int]
) -> None:
    _photo_looks_like(agent_client, "SOAP_EMPTY")

    case_id = _report_with_photo(agent_client, reporter)

    [check] = _checks(db_session, case_id)
    assert check.decision == "AGREES"
    assert check.output_json["photo_suggestions"][0]["case_type_code"] == "SOAP_EMPTY"


def test_conflicting_photo_sends_a_waiting_case_to_review(
    agent_client: TestClient, db_session: Session, reporter: tuple[Headers, int]
) -> None:
    _photo_looks_like(agent_client, None)
    headers, location_id = reporter
    body = {"description": SOAP, "location_id": location_id}
    case_id = int(agent_client.post("/api/v1/cases", json=body, headers=headers).json()["id"])
    case = db_session.get(Case, case_id)
    assert case is not None
    case.status, case.needs_human_review = CaseStatus.CLASSIFIED, False
    db_session.flush()
    _photo_looks_like(agent_client, "WATER_LEAK")

    files = {"file": ("sizinti.jpg", _jpeg(), "image/jpeg")}
    agent_client.post(f"/api/v1/cases/{case_id}/attachments", files=files, headers=headers)

    [check] = _checks(db_session, case_id)
    assert check.decision == "CONFLICTS"
    db_session.refresh(case)
    assert case.needs_human_review is True


def test_without_the_model_no_check_is_recorded(
    agent_client: TestClient, db_session: Session, reporter: tuple[Headers, int]
) -> None:
    _photo_looks_like(agent_client, None)

    case_id = _report_with_photo(agent_client, reporter)

    assert _checks(db_session, case_id) == []


def test_panel_shows_the_check_with_a_turkish_label(
    agent_client: TestClient, db_session: Session, reporter: tuple[Headers, int]
) -> None:
    _photo_looks_like(agent_client, "SOAP_EMPTY")
    case_id = _report_with_photo(agent_client, reporter)
    manager = bearer(agent_client, "mudur.destek@kampus.example.com", PASSWORD)

    decisions = agent_client.get(f"/api/v1/cases/{case_id}/decisions", headers=manager).json()

    [check] = [d for d in decisions if d["agent_name"] == "photo_check"]
    assert check["agent_label"] == "Fotoğraf kontrolü"
    assert check["decision_label"] == "Fotoğraf metinle uyumlu"
