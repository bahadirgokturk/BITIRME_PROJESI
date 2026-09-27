"""API sozlesmesi: semalar OpenAPI'de yayinda ve girdi is mantigindan once dogrulanir.

Sozlesme-once endpoint'ler (501, NotImplementedYetError) eklenince burada listelenir.
"""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.models import User
from app.models.enums import UserRole

VALID_USER = {
    "email": "ayse@example.edu.tr",
    "full_name": "Ayşe Yılmaz",
    "role": "REPORTER",
    "reporter_kind": "STUDENT",
    "password": "cok-gizli-parola-123",
}
VALID_LOCATION = {"kind": "WC", "code": "B-2-WCM", "name": "B Blok 2. Kat Erkek WC"}


@pytest.fixture
def admin_app(test_app: FastAPI) -> Iterator[FastAPI]:
    # Rol kontrolu tests/integration/test_rbac_api.py'de; burada yalniz sozlesme dogrulanir
    admin = User(id=1, organization_id=1, role=UserRole.ADMIN, is_active=True)
    test_app.dependency_overrides[get_current_user] = lambda: admin
    yield test_app
    test_app.dependency_overrides.clear()


def test_contract_schemas_are_in_openapi(test_app: FastAPI) -> None:
    schemas = TestClient(test_app).get("/openapi.json").json()["components"]["schemas"]

    expected = {
        "LoginRequest",
        "TokenRead",
        "UserRead",
        "UserRole",
        "Page_UserRead_",
        "DepartmentRead",
        "LocationRead",
        "LocationKind",
    }
    assert expected <= set(schemas)


def test_user_role_enum_matches_database_enum(test_app: FastAPI) -> None:
    schemas = TestClient(test_app).get("/openapi.json").json()["components"]["schemas"]

    assert schemas["UserRole"]["enum"] == ["REPORTER", "STAFF", "MANAGER", "ADMIN"]


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/api/v1/auth/login", {"email": "not-an-email", "password": "x"}),
        ("/api/v1/admin/users", {**VALID_USER, "role": "SUPERUSER"}),
        ("/api/v1/admin/locations", {**VALID_LOCATION, "importance_weight": 101}),
    ],
)
def test_contract_validates_input_before_business_logic(
    admin_app: FastAPI, path: str, body: dict[str, object]
) -> None:
    # Gecersiz girdi servis katmanina ulasmadan 422 ile reddedilir
    response = TestClient(admin_app).post(path, json=body)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
