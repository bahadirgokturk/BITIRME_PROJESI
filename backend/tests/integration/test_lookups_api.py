"""Yonetici ekranlari icin sozlukler ve konum aramasi (frontend istegi: duzeltme acilir listeleri,
/report konum aramasi, AI panelinde Turkce karar adlari)."""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Organization
from app.repositories import case_type_repository, department_repository, location_repository
from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
Headers = dict[str, str]


@dataclass
class Campus:
    organization: Organization
    reporter: Headers
    staff: Headers
    manager: Headers


@pytest.fixture
def campus(agent_client: TestClient, db_session: Session) -> Campus:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    return Campus(
        organization=organization,
        reporter=bearer(agent_client, "ogrenci@kampus.example.com", PASSWORD),
        staff=bearer(agent_client, "temizlik@kampus.example.com", PASSWORD),
        manager=bearer(agent_client, "mudur.destek@kampus.example.com", PASSWORD),
    )


def _codes(client: TestClient, headers: Headers, **params: object) -> list[str]:
    body = client.get("/api/v1/locations", params=params, headers=headers).json()
    return [item["code"] for item in body["items"]]


# --- Konum aramasi ------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("kutuphane", "B-KUT"),  # Turkce karakter yazmadan
        ("KÜTÜPHANE", "B-KUT"),  # buyuk harf
        ("asansör", "B-ASN"),  # takma ad
        ("a-101", "A-101"),  # kod
        ("çimenlik", "BHC"),  # takma ad
    ],
)
def test_locations_can_be_searched(
    agent_client: TestClient, campus: Campus, query: str, expected: str
) -> None:
    assert expected in _codes(agent_client, campus.reporter, q=query)


def test_search_narrows_the_list_and_the_total(agent_client: TestClient, campus: Campus) -> None:
    everything = agent_client.get("/api/v1/locations", headers=campus.reporter).json()
    found = agent_client.get(
        "/api/v1/locations", params={"q": "wc"}, headers=campus.reporter
    ).json()

    assert 0 < found["total"] < everything["total"]
    assert all("WC" in item["code"] or "WC" in item["name"] for item in found["items"])


def test_search_without_a_match_is_empty(agent_client: TestClient, campus: Campus) -> None:
    assert _codes(agent_client, campus.reporter, q="uzay istasyonu") == []


def test_inactive_locations_are_not_found(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    library = location_repository.get_by_code(db_session, campus.organization.id, "B-KUT")
    assert library is not None
    library.is_active = False
    db_session.flush()

    assert "B-KUT" not in _codes(agent_client, campus.reporter, q="kutuphane")


# --- Tur ve birim sozlukleri --------------------------------------------------------------


def test_manager_lists_active_case_types_with_names(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    soap = case_type_repository.get_by_code(db_session, campus.organization.id, "SOAP_EMPTY")
    assert soap is not None
    soap.is_active = False
    db_session.flush()

    items = agent_client.get("/api/v1/case-types", headers=campus.manager).json()

    by_code = {item["code"]: item for item in items}
    assert by_code["TRASH_FULL"]["name"] == "Çöp dolu"
    assert by_code["TRASH_FULL"]["category"] == "CLEANING"
    assert by_code["TRASH_FULL"]["default_department"]["code"] == "SUPPORT_SERVICES"
    assert by_code["OTHER"]["default_department"] is None
    assert "SOAP_EMPTY" not in by_code


def test_manager_lists_active_departments(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    nutrition = department_repository.get_by_code(db_session, campus.organization.id, "NUTRITION")
    assert nutrition is not None
    nutrition.is_active = False
    db_session.flush()

    items = agent_client.get("/api/v1/departments", headers=campus.manager).json()

    codes = [item["code"] for item in items]
    assert "SUPPORT_SERVICES" in codes and "NUTRITION" not in codes
    assert all(item["name"] for item in items)


@pytest.mark.parametrize("path", ["/api/v1/case-types", "/api/v1/departments"])
@pytest.mark.parametrize("who", ["reporter", "staff"])
def test_only_managers_and_admins_read_the_lists(
    agent_client: TestClient, campus: Campus, path: str, who: str
) -> None:
    assert agent_client.get(path, headers=getattr(campus, who)).status_code == 403


# --- Karar adlari -------------------------------------------------------------------------


def test_decisions_come_with_turkish_labels(
    agent_client: TestClient, db_session: Session, campus: Campus
) -> None:
    wc = location_repository.get_by_code(db_session, campus.organization.id, "A-1-WCE")
    assert wc is not None
    body = {"description": "Tuvalette sabun bitmiş, sabunluklar bomboş", "location_id": wc.id}
    case_id = agent_client.post("/api/v1/cases", json=body, headers=campus.reporter).json()["id"]

    decisions = agent_client.get(
        f"/api/v1/cases/{case_id}/decisions", headers=campus.manager
    ).json()

    labels = {d["agent_name"]: (d["agent_label"], d["decision_label"]) for d in decisions}
    assert labels["classification"] == ("Sınıflandırma", "Sabun bitti")
    assert labels["priority"] == ("Öncelik", "Düşük")
    assert labels["supervisor"] == ("Karar", "Otomatik atandı")
