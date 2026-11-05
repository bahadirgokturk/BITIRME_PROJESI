from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import ConflictError, NotFoundError


class Payload(BaseModel):
    count: int


def _client_with_failing_routes(app: FastAPI) -> TestClient:
    @app.get("/boom/not-found")
    def raise_not_found() -> None:
        raise NotFoundError(details={"resource": "case"})

    @app.get("/boom/conflict")
    def raise_conflict() -> None:
        raise ConflictError()

    @app.post("/boom/validate")
    def validate(payload: Payload) -> Payload:
        return payload

    return TestClient(app)


def test_domain_error_is_rendered_in_standard_format(test_app: FastAPI) -> None:
    client = _client_with_failing_routes(test_app)

    response = client.get("/boom/not-found")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["details"] == {"resource": "case"}
    assert body["error"]["message"]


def test_conflict_error_maps_to_409(test_app: FastAPI) -> None:
    client = _client_with_failing_routes(test_app)

    response = client.get("/boom/conflict")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_unknown_route_uses_standard_error_format(test_app: FastAPI) -> None:
    response = TestClient(test_app).get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_validation_error_uses_standard_error_format(test_app: FastAPI) -> None:
    client = _client_with_failing_routes(test_app)

    response = client.post("/boom/validate", json={"count": "not-a-number"})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"]["fields"][0]["loc"] == ["body", "count"]


def test_create_app_exposes_openapi_under_api_prefix(test_app: FastAPI) -> None:
    paths = TestClient(test_app).get("/openapi.json").json()["paths"]

    assert "/api/v1/health" in paths
