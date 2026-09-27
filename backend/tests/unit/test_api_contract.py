"""API sozlesmesi: semalar OpenAPI'de yayinda ve girdi is mantigindan once dogrulanir.

Sozlesme-once endpoint'ler (501) CONTRACT_STUBS'ta; uygulaninca satir silinir.
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
VALID_CASE = {"description": "B Blok 2. kat erkek tuvaletinde sabun bitmiş.", "location_id": 1}

# FAZ 3 sozlesmesi: sema yayinda, is mantigi sonraki PR'larda (E3-1, E3-2)
CONTRACT_STUBS: list[tuple[str, str, dict[str, object] | None]] = [
    ("POST", "/api/v1/cases", VALID_CASE),
    ("GET", "/api/v1/cases", None),
    ("GET", "/api/v1/cases/mine", None),
    ("GET", "/api/v1/cases/1", None),
    ("GET", "/api/v1/cases/1/events", None),
]


@pytest.fixture
def admin_app(test_app: FastAPI) -> Iterator[FastAPI]:
    # Rol kontrolu tests/integration/test_rbac_api.py'de; burada yalniz sozlesme dogrulanir
    admin = User(id=1, organization_id=1, role=UserRole.ADMIN, is_active=True)
    test_app.dependency_overrides[get_current_user] = lambda: admin
    yield test_app
    test_app.dependency_overrides.clear()


@pytest.mark.parametrize(("method", "path", "body"), CONTRACT_STUBS)
def test_contract_endpoint_is_published_but_not_implemented(
    admin_app: FastAPI, method: str, path: str, body: dict[str, object] | None
) -> None:
    response = TestClient(admin_app).request(method, path, json=body)

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "NOT_IMPLEMENTED"


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
        "LocationOption",
        "CaseCreate",
        "CaseRead",
        "CaseStatus",
        "CaseEventRead",
        "Page_CaseRead_",
    }
    assert expected <= set(schemas)


def test_user_role_enum_matches_database_enum(test_app: FastAPI) -> None:
    schemas = TestClient(test_app).get("/openapi.json").json()["components"]["schemas"]

    assert schemas["UserRole"]["enum"] == ["REPORTER", "STAFF", "MANAGER", "ADMIN"]


def test_case_status_enum_matches_the_workflow(test_app: FastAPI) -> None:
    # docs/WORKFLOW.md bolum 1 ve docs/DATABASE.md bolum 2 ile ayni sira
    schemas = TestClient(test_app).get("/openapi.json").json()["components"]["schemas"]

    assert schemas["CaseStatus"]["enum"] == [
        "NEW",
        "ANALYZING",
        "NEEDS_INFO",
        "CLASSIFIED",
        "ASSIGNED",
        "ACCEPTED",
        "IN_PROGRESS",
        "RESOLVED",
        "VERIFICATION",
        "CLOSED",
        "REOPENED",
        "ESCALATED",
        "REJECTED",
        "MERGED",
    ]


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/api/v1/auth/login", {"email": "not-an-email", "password": "x"}),
        ("/api/v1/admin/users", {**VALID_USER, "role": "SUPERUSER"}),
        ("/api/v1/admin/locations", {**VALID_LOCATION, "importance_weight": 101}),
        ("/api/v1/cases", {**VALID_CASE, "description": "kısa"}),
        ("/api/v1/cases", {"description": VALID_CASE["description"]}),
    ],
)
def test_contract_validates_input_before_business_logic(
    admin_app: FastAPI, path: str, body: dict[str, object]
) -> None:
    # Gecersiz girdi servis katmanina ulasmadan 422 ile reddedilir
    response = TestClient(admin_app).post(path, json=body)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
