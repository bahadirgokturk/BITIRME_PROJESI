"""Rol bazli erisim: admin endpoint'leri yalniz ADMIN'e acik (docs/WORKFLOW.md bolum 4)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from tests.integration.factories import DEFAULT_PASSWORD, make_user

ADMIN_ENDPOINTS = [
    ("GET", "/api/v1/admin/users"),
    ("GET", "/api/v1/admin/departments"),
    ("GET", "/api/v1/admin/locations"),
    ("PATCH", "/api/v1/admin/users/1"),
]


def _token_for(client: TestClient, db_session: Session, role: UserRole) -> dict[str, str]:
    email = f"{role.value.lower()}@example.edu.tr"
    make_user(db_session, email=email, role=role)
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": DEFAULT_PASSWORD}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.parametrize(("method", "path"), ADMIN_ENDPOINTS)
def test_admin_endpoints_require_login(client: TestClient, method: str, path: str) -> None:
    response = client.request(method, path, json={})

    assert response.status_code == 401


@pytest.mark.parametrize("role", [UserRole.REPORTER, UserRole.STAFF, UserRole.MANAGER])
@pytest.mark.parametrize(("method", "path"), ADMIN_ENDPOINTS)
def test_non_admin_roles_are_forbidden(
    client: TestClient, db_session: Session, role: UserRole, method: str, path: str
) -> None:
    # MANAGER dahil: yonetici operasyon yapar, sistem tanimlarini degistirmez (gorev ayriligi)
    headers = _token_for(client, db_session, role)

    response = client.request(method, path, json={}, headers=headers)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_admin_passes_the_role_check(client: TestClient, db_session: Session) -> None:
    headers = _token_for(client, db_session, UserRole.ADMIN)

    response = client.get("/api/v1/admin/users", headers=headers)

    assert response.status_code == 200


def test_role_check_runs_before_input_validation(client: TestClient, db_session: Session) -> None:
    # Yetkisiz kullanici gecersiz govdeyle bile 403 alir; dogrulama hatalari sema bilgisi sizdirmaz
    headers = _token_for(client, db_session, UserRole.REPORTER)

    response = client.post("/api/v1/admin/users", json={"email": "bozuk"}, headers=headers)

    assert response.status_code == 403
