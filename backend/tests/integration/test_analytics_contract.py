"""FAZ 6 sozlesmesi (PROJECT_PLAN bolum 1): analitik ve agent metrik endpoint'leri OpenAPI'de;
is mantigi gelene kadar 501. Rol ve parametre dogrulamasi simdiden calisir."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from seeds.campus import seed_campus, seed_demo_users
from tests.integration.factories import bearer

PASSWORD = "demo-parola-123"
READS = [
    "/api/v1/analytics/kpis",
    "/api/v1/analytics/trend",
    "/api/v1/analytics/categories",
    "/api/v1/analytics/locations",
    "/api/v1/analytics/resolution-times",
    "/api/v1/analytics/sla",
    "/api/v1/analytics/aging",
    "/api/v1/analytics/departments",
    "/api/v1/analytics/recurring",
    "/api/v1/analytics/process",
    "/api/v1/agents/metrics",
]


@pytest.fixture
def tokens(client: TestClient, db_session: Session) -> dict[str, dict[str, str]]:
    organization = seed_campus(db_session)
    seed_demo_users(db_session, organization, PASSWORD)
    emails = {
        "manager": "mudur.destek@kampus.example.com",
        "admin": "admin@kampus.example.com",
        "reporter": "ogrenci@kampus.example.com",
        "staff": "temizlik@kampus.example.com",
    }
    return {role: bearer(client, email, PASSWORD) for role, email in emails.items()}


# Is mantigi henuz gelmeyenler; bildirim KPI'lari test_analytics_cases.py'de
NOT_IMPLEMENTED = [
    "/api/v1/analytics/departments",
    "/api/v1/analytics/recurring",
    "/api/v1/analytics/process",
    "/api/v1/agents/metrics",
]


@pytest.mark.parametrize("path", NOT_IMPLEMENTED)
@pytest.mark.parametrize("role", ["manager", "admin"])
def test_reads_are_published_but_not_implemented_yet(
    client: TestClient, tokens: dict[str, dict[str, str]], path: str, role: str
) -> None:
    response = client.get(path, headers=tokens[role])

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "NOT_IMPLEMENTED"


def test_summary_is_published_but_not_implemented_yet(
    client: TestClient, tokens: dict[str, dict[str, str]]
) -> None:
    response = client.post(
        "/api/v1/analytics/summary", json={"period": "7d"}, headers=tokens["manager"]
    )

    assert response.status_code == 501


@pytest.mark.parametrize("path", READS)
@pytest.mark.parametrize("role", ["reporter", "staff"])
def test_only_managers_and_admins_see_analytics(
    client: TestClient, tokens: dict[str, dict[str, str]], path: str, role: str
) -> None:
    assert client.get(path, headers=tokens[role]).status_code == 403


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/api/v1/analytics/kpis", {"from": "2026-10-10", "to": "2026-10-01"}),
        ("/api/v1/analytics/kpis", {"from": "2025-01-01", "to": "2026-10-01"}),
        ("/api/v1/analytics/trend", {"granularity": "hour"}),
        ("/api/v1/analytics/locations", {"level": "room"}),
    ],
    ids=["reversed-period", "period-too-long", "unknown-granularity", "unknown-level"],
)
def test_invalid_parameters_are_rejected(
    client: TestClient, tokens: dict[str, dict[str, str]], path: str, params: dict[str, str]
) -> None:
    response = client.get(path, params=params, headers=tokens["manager"])

    assert response.status_code == 422


def test_summary_period_must_be_known(
    client: TestClient, tokens: dict[str, dict[str, str]]
) -> None:
    response = client.post(
        "/api/v1/analytics/summary", json={"period": "1y"}, headers=tokens["manager"]
    )

    assert response.status_code == 422


def test_schemas_are_in_openapi(client: TestClient) -> None:
    schemas = client.get("/openapi.json").json()["components"]["schemas"]

    for name in ("KpisRead", "TrendRead", "RecurringRead", "ProcessRead", "AgentMetricsRead"):
        assert name in schemas
