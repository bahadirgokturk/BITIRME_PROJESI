"""Bildirmeden once tekrar kontrolu (docs/API.md "Cases", AGENTS.md 4.3): form yazilirken ayni
yerdeki acik bildirim gosterilir; kisi "destekle" derse kendi kaydi o bildirime baglanir ve ana
kayit cozulunce haber alir. Gercek egitilmis model kullanilir."""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Case, Organization
from app.repositories import location_repository
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
SOAP = "Tuvalette sabun bitmiş, sabunluklar bomboş"
SIMILAR = "/api/v1/cases/similar"
SUPPORT = "/api/v1/cases/support"
Headers = dict[str, str]


@dataclass
class Campus:
    organization: Organization
    first: Headers
    second: Headers
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
        first=bearer(agent_client, "ogrenci@kampus.example.com", PASSWORD),
        second=bearer(agent_client, "akademisyen@kampus.example.com", PASSWORD),
        manager=bearer(agent_client, "mudur.destek@kampus.example.com", PASSWORD),
        wc_id=location("A-1-WCE"),
        other_building_wc_id=location("B-Z-WC"),
    )


def _report(client: TestClient, campus: Campus) -> dict:
    body = {"description": SOAP, "location_id": campus.wc_id}
    created = client.post("/api/v1/cases", json=body, headers=campus.first)
    assert created.status_code == 201
    case: dict = client.get(f"/api/v1/cases/{created.json()['id']}", headers=campus.manager).json()
    return case


def _similar(client: TestClient, campus: Campus, location_id: int) -> list[dict]:
    body = {"description": "Sabun kalmamış, eller yıkanamıyor", "location_id": location_id}
    response = client.post(SIMILAR, json=body, headers=campus.second)
    assert response.status_code == 200, response.text
    items: list[dict] = response.json()["items"]
    return items


def test_open_report_at_the_same_spot_is_shown_before_sending(
    agent_client: TestClient, campus: Campus
) -> None:
    first = _report(agent_client, campus)

    [item] = _similar(agent_client, campus, campus.wc_id)

    assert item["case_id"] == first["id"]
    assert item["case_type_name"] == "Sabun bitti"
    assert item["location_name"] == "A Blok 1. Kat Erkek WC"
    assert item["supporters"] == 1
    assert item["created_at"] == first["created_at"]
    # Baskasinin yazdigi metin ve numarasi gosterilmez (gizlilik)
    assert not {"description", "title", "case_number", "reporter_id"} & item.keys()


def test_nothing_is_shown_for_another_building_or_without_open_reports(
    agent_client: TestClient, campus: Campus
) -> None:
    assert _similar(agent_client, campus, campus.wc_id) == []
    _report(agent_client, campus)

    assert _similar(agent_client, campus, campus.other_building_wc_id) == []


def test_supporting_links_my_report_to_the_open_one(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    first = _report(agent_client, campus)
    body = {
        "description": "Sabun kalmamış, eller yıkanamıyor",
        "location_id": campus.wc_id,
        "case_id": first["id"],
    }

    supported = agent_client.post(SUPPORT, json=body, headers=campus.second)

    assert supported.status_code == 201, supported.text
    mine = supported.json()
    assert mine["status"] == "MERGED"
    assert mine["case_type"]["code"] == "SOAP_EMPTY"
    own = agent_client.get(f"/api/v1/cases/{mine['id']}", headers=campus.second)
    assert own.status_code == 200
    parent = db_session.get(Case, first["id"])
    assert parent is not None
    db_session.refresh(parent)
    assert parent.duplicate_count == 1
    # Destek tekrar kontrolde gorunur: artik iki kisi
    [item] = _similar(agent_client, campus, campus.wc_id)
    assert item["supporters"] == 2


def test_cannot_support_a_report_that_is_not_similar(
    agent_client: TestClient, campus: Campus
) -> None:
    first = _report(agent_client, campus)
    body = {
        "description": "Sabun kalmamış, eller yıkanamıyor",
        "location_id": campus.other_building_wc_id,
        "case_id": first["id"],
    }

    refused = agent_client.post(SUPPORT, json=body, headers=campus.second)

    # Benzer bulunmayan kayit (baska bina) disaridan secilemez; varligi da soylenmez
    assert refused.status_code == 404


def test_description_rules_are_the_same_as_the_report_form(
    agent_client: TestClient, campus: Campus
) -> None:
    short = {"description": "sabun", "location_id": campus.wc_id}

    response = agent_client.post(SIMILAR, json=short, headers=campus.second)

    assert response.status_code == 422


def test_a_different_problem_at_the_same_spot_is_not_shown(
    agent_client: TestClient, campus: Campus
) -> None:
    _report(agent_client, campus)
    # Su kacagi yayilan bir sorundur: ayni yerdeki sabun bildirimi aday olur ama benzer degildir
    body = {
        "description": "Lavabonun altındaki boru su kaçırıyor, yer göl oldu",
        "location_id": campus.wc_id,
    }

    response = agent_client.post(SIMILAR, json=body, headers=campus.second)

    assert response.json()["items"] == []
