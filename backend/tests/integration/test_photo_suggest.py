"""Fotograftan tur onerisi (POST /cases/photo-suggest): bildirim formu fotograf cekilince sorar.

Gercek CLIP yerine sahte kodlayici: istem bankasindaki bir cumlenin vektorunu dondurur. Fotograf
saklanmaz; yanit kurumun aktif turlerinin Turkce adlariyla doner.
"""

from io import BytesIO

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents.vision import PromptBank
from app.agents.vision_model import VISION_DIR, VisionModel, load_bank
from app.api.deps import get_vision_model
from app.models import Attachment, CaseType
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

URL = "/api/v1/cases/photo-suggest"
PASSWORD = "demo-parola-123"
Headers = dict[str, str]


class FakeEncoder:
    """Bankadaki ilk `code` cumlesinin vektoru: o tur acik ara kazanir."""

    def __init__(self, bank: PromptBank, code: str) -> None:
        index = bank.labels.index(code)
        self._vector = bank.embeddings[index].tolist()

    def encode(self, data: bytes) -> list[float]:
        Image.open(BytesIO(data)).verify()
        return self._vector


def _jpeg() -> bytes:
    output = BytesIO()
    Image.new("RGB", (640, 480), (240, 240, 240)).save(output, format="JPEG")
    return output.getvalue()


@pytest.fixture
def reporter(client: TestClient, db_session: Session) -> Headers:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    return bearer(client, "ogrenci@kampus.example.com", PASSWORD)


def _looks_like(client: TestClient, code: str | None) -> None:
    bank = load_bank(VISION_DIR)
    model = VisionModel(encoder=FakeEncoder(bank, code), bank=bank) if code else None
    client.app.dependency_overrides[get_vision_model] = lambda: model  # type: ignore[attr-defined]


def _send(client: TestClient, headers: Headers, data: bytes, name: str = "foto.jpg"):  # type: ignore[no-untyped-def]
    return client.post(URL, files={"file": (name, data, "image/jpeg")}, headers=headers)


def test_soap_photo_suggests_soap_with_its_turkish_name(
    client: TestClient, reporter: Headers
) -> None:
    _looks_like(client, "SOAP_EMPTY")

    response = _send(client, reporter, _jpeg())

    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    first = body["suggestions"][0]
    assert (first["case_type_code"], first["name"]) == ("SOAP_EMPTY", "Sabun bitti")
    assert 0.5 < first["confidence"] <= 1


def test_photo_without_a_problem_returns_no_suggestion(
    client: TestClient, reporter: Headers
) -> None:
    _looks_like(client, "_NONE")

    body = _send(client, reporter, _jpeg()).json()

    assert body == {"available": True, "suggestions": []}


def test_inactive_case_type_is_not_suggested(
    client: TestClient, reporter: Headers, db_session: Session
) -> None:
    _looks_like(client, "SOAP_EMPTY")
    soap = db_session.scalars(select(CaseType).where(CaseType.code == "SOAP_EMPTY")).one()
    soap.is_active = False
    db_session.flush()

    codes = [s["case_type_code"] for s in _send(client, reporter, _jpeg()).json()["suggestions"]]

    assert "SOAP_EMPTY" not in codes


def test_without_the_model_the_form_is_told_it_is_unavailable(
    client: TestClient, reporter: Headers
) -> None:
    _looks_like(client, None)

    body = _send(client, reporter, _jpeg()).json()

    assert body == {"available": False, "suggestions": []}


def test_photo_is_not_stored(client: TestClient, reporter: Headers, db_session: Session) -> None:
    _looks_like(client, "SOAP_EMPTY")

    _send(client, reporter, _jpeg())

    assert db_session.scalar(select(func.count()).select_from(Attachment)) == 0


@pytest.mark.parametrize("data", [b"%PDF-1.7 belge", b"\xff\xd8\xff bozuk"])
def test_non_image_or_broken_image_is_415(
    client: TestClient, reporter: Headers, data: bytes
) -> None:
    _looks_like(client, "SOAP_EMPTY")

    response = _send(client, reporter, data)

    assert response.status_code == 415


def test_too_large_photo_is_413(client: TestClient, reporter: Headers) -> None:
    _looks_like(client, "SOAP_EMPTY")
    limit = client.app.state.settings.max_upload_mb * 1024 * 1024  # type: ignore[attr-defined]

    response = _send(client, reporter, b"\xff\xd8\xff" + bytes(limit))

    assert response.status_code == 413


def test_login_is_required(client: TestClient) -> None:
    assert _send(client, {}, _jpeg()).status_code == 401


def test_bank_vectors_stay_unit_length() -> None:
    assert np.allclose(np.linalg.norm(load_bank(VISION_DIR).embeddings, axis=1), 1.0, atol=1e-4)
