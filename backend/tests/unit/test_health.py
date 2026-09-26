from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.api.v1.health import get_health_service
from app.services.health_service import HealthReport, HealthService


class _FakeSession:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.executed = 0

    def execute(self, _statement: object) -> None:
        self.executed += 1
        if self.error is not None:
            raise self.error


def test_service_reports_ok_when_database_answers() -> None:
    session = _FakeSession()

    report = HealthService(session).check()  # type: ignore[arg-type]

    assert report == HealthReport(status="ok", database="ok")
    assert session.executed == 1


def test_service_reports_degraded_when_database_is_unreachable() -> None:
    error = OperationalError("SELECT 1", {}, Exception("connection refused"))

    report = HealthService(_FakeSession(error)).check()  # type: ignore[arg-type]

    assert report == HealthReport(status="degraded", database="unavailable")


def test_service_does_not_hide_programming_errors() -> None:
    with pytest.raises(TypeError):
        HealthService(_FakeSession(TypeError("bug"))).check()  # type: ignore[arg-type]


@pytest.fixture
def client_with_report(test_app: FastAPI) -> Iterator[tuple[TestClient, list[HealthReport]]]:
    reports: list[HealthReport] = []

    class _StubService:
        def check(self) -> HealthReport:
            return reports[0]

    test_app.dependency_overrides[get_health_service] = _StubService
    yield TestClient(test_app), reports
    test_app.dependency_overrides.clear()


def test_health_endpoint_returns_200_when_ok(
    client_with_report: tuple[TestClient, list[HealthReport]],
) -> None:
    client, reports = client_with_report
    reports.append(HealthReport(status="ok", database="ok"))

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_endpoint_returns_503_when_degraded(
    client_with_report: tuple[TestClient, list[HealthReport]],
) -> None:
    client, reports = client_with_report
    reports.append(HealthReport(status="degraded", database="unavailable"))

    response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"
