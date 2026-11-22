"""GET /analytics/weekly-report: mudurun indirdigi haftalik PDF."""

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy.orm import Session

from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

URL = "/api/v1/analytics/weekly-report"
PASSWORD = "demo-parola-123"


@pytest.fixture
def manager(client: TestClient, db_session: Session) -> dict[str, str]:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    return bearer(client, "mudur.destek@kampus.example.com", PASSWORD)


def test_manager_downloads_the_chosen_week_as_pdf(
    client: TestClient, manager: dict[str, str]
) -> None:
    response = client.get(URL, params={"week": "2026-09-23"}, headers=manager)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "haftalik-rapor-2026-09-21.pdf" in response.headers["content-disposition"]
    text = " ".join(p.extract_text() for p in PdfReader(BytesIO(response.content)).pages)
    assert "Haftalık Yönetici Raporu" in text
    assert "21 - 27 Eylül 2026" in text
    # Bildirimi olmayan birimler de satir olarak gelir
    assert "Destek Hizmetleri" in text


def test_default_is_the_last_completed_week(client: TestClient, manager: dict[str, str]) -> None:
    # Test saati 26.09.2026 cumartesi: bir onceki hafta 14-20 Eylul
    response = client.get(URL, headers=manager)

    assert "haftalik-rapor-2026-09-14.pdf" in response.headers["content-disposition"]


def test_reporter_cannot_download(client: TestClient, manager: dict[str, str]) -> None:
    reporter = bearer(client, "ogrenci@kampus.example.com", PASSWORD)

    assert client.get(URL, headers=reporter).status_code == 403


def test_bad_date_is_422(client: TestClient, manager: dict[str, str]) -> None:
    assert client.get(URL, params={"week": "gecen-hafta"}, headers=manager).status_code == 422
