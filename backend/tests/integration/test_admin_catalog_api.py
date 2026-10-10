"""Admin tanimlari: bildirim turleri, SLA kurallari, agent politikalari (docs/API.md "Admin").

Ortak kurallar: yalniz ADMIN, kurum kapsami (baska kurumun kaydi 404), silme yok (is_active).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from tests.integration.factories import login_headers

ADMIN = "/api/v1/admin"
Headers = dict[str, str]
Body = dict[str, object]


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> Headers:
    return login_headers(client, db_session, email="admin@kampus-a.edu.tr")


@pytest.fixture
def other_admin(client: TestClient, db_session: Session) -> Headers:
    # login_headers her kullanici icin yeni kurum acar
    return login_headers(client, db_session, email="admin@kampus-b.edu.tr")


def _post(client: TestClient, path: str, body: Body, headers: Headers) -> Body:
    response = client.post(f"{ADMIN}/{path}", json=body, headers=headers)
    assert response.status_code == 201, response.text
    created: Body = response.json()
    return created


def _department(client: TestClient, headers: Headers, code: str = "SUPPORT_SERVICES") -> int:
    created = _post(client, "departments", {"code": code, "name": "Destek"}, headers)
    return int(str(created["id"]))


def _case_type(
    client: TestClient, headers: Headers, code: str = "SOAP_EMPTY", **changes: object
) -> Body:
    body: Body = {
        "code": code,
        "name": "Sabun bitti",
        "category": "CONSUMABLE",
        "base_priority": "LOW",
        "base_severity": 20,
        "keywords": ["sabun", "sabunluk"],
        **changes,
    }
    return _post(client, "case-types", body, headers)


# --- Bildirim turleri ---------------------------------------------------------------------


def test_case_type_is_created_with_its_department(client: TestClient, admin: Headers) -> None:
    department_id = _department(client, admin)

    created = _case_type(client, admin, default_department_id=department_id)
    listing = client.get(f"{ADMIN}/case-types", headers=admin).json()

    assert created["default_department_id"] == department_id
    assert created["secondary_department_id"] is None
    assert created["is_safety_related"] is False
    assert created["is_active"] is True
    assert [item["code"] for item in listing["items"]] == ["SOAP_EMPTY"]


def test_new_case_type_gets_a_default_agent_policy(client: TestClient, admin: Headers) -> None:
    created = _case_type(client, admin)

    policies = client.get(f"{ADMIN}/agent-policies", headers=admin).json()["items"]

    assert len(policies) == 1
    assert policies[0]["case_type_id"] == created["id"]
    assert policies[0]["autonomy_level"] == "L2_NOTIFY"
    assert policies[0]["min_confidence_auto"] == pytest.approx(0.70)
    assert policies[0]["notify_manager"] is True


def test_duplicate_case_type_code_is_409(client: TestClient, admin: Headers) -> None:
    _case_type(client, admin)

    response = client.post(
        f"{ADMIN}/case-types",
        json={
            "code": "SOAP_EMPTY",
            "name": "Başka",
            "category": "CLEANING",
            "base_priority": "LOW",
            "base_severity": 10,
        },
        headers=admin,
    )

    assert response.status_code == 409


def test_department_of_another_organization_is_404(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    foreign = _department(client, other_admin)

    response = client.post(
        f"{ADMIN}/case-types",
        json={
            "code": "SOAP_EMPTY",
            "name": "Sabun bitti",
            "category": "CONSUMABLE",
            "base_priority": "LOW",
            "base_severity": 20,
            "default_department_id": foreign,
        },
        headers=admin,
    )

    assert response.status_code == 404


def test_case_type_update_changes_only_sent_fields(client: TestClient, admin: Headers) -> None:
    department_id = _department(client, admin)
    created = _case_type(client, admin, default_department_id=department_id)

    response = client.patch(
        f"{ADMIN}/case-types/{created['id']}",
        json={"name": "Sıvı sabun bitti", "keywords": ["sabun"], "default_department_id": None},
        headers=admin,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Sıvı sabun bitti"
    assert body["keywords"] == ["sabun"]
    assert body["default_department_id"] is None
    assert body["base_priority"] == "LOW"


def test_deactivated_case_type_leaves_the_lookup(client: TestClient, admin: Headers) -> None:
    created = _case_type(client, admin)

    client.patch(f"{ADMIN}/case-types/{created['id']}", json={"is_active": False}, headers=admin)

    assert client.get("/api/v1/case-types", headers=admin).json() == []
    assert client.get(f"{ADMIN}/case-types", headers=admin).json()["total"] == 1


def test_null_for_a_required_field_changes_nothing(client: TestClient, admin: Headers) -> None:
    created = _case_type(client, admin)

    response = client.patch(
        f"{ADMIN}/case-types/{created['id']}", json={"name": None}, headers=admin
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Sabun bitti"


def test_severity_outside_the_range_is_422(client: TestClient, admin: Headers) -> None:
    response = client.post(
        f"{ADMIN}/case-types",
        json={
            "code": "SOAP_EMPTY",
            "name": "Sabun bitti",
            "category": "CONSUMABLE",
            "base_priority": "LOW",
            "base_severity": 101,
        },
        headers=admin,
    )

    assert response.status_code == 422


def test_case_type_of_another_organization_is_404(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    foreign = _case_type(client, other_admin)

    response = client.patch(
        f"{ADMIN}/case-types/{foreign['id']}", json={"name": "Ele geçirildi"}, headers=admin
    )

    assert response.status_code == 404
    assert client.get(f"{ADMIN}/case-types", headers=admin).json()["total"] == 0


# --- SLA kurallari ------------------------------------------------------------------------


def _rule(client: TestClient, headers: Headers, **changes: object) -> Body:
    body: Body = {
        "priority": "HIGH",
        "response_minutes": 30,
        "resolution_minutes": 240,
        **changes,
    }
    return _post(client, "sla-rules", body, headers)


def test_default_and_type_specific_rules(client: TestClient, admin: Headers) -> None:
    case_type = _case_type(client, admin)

    default = _rule(client, admin)
    specific = _rule(client, admin, case_type_id=case_type["id"], warning_threshold_pct=50)
    listing = client.get(f"{ADMIN}/sla-rules", headers=admin).json()

    assert default["case_type_id"] is None
    assert default["warning_threshold_pct"] == 75
    assert specific["warning_threshold_pct"] == 50
    assert listing["total"] == 2


@pytest.mark.parametrize("typed", [False, True])
def test_second_rule_for_the_same_target_is_409(
    client: TestClient, admin: Headers, typed: bool
) -> None:
    changes: Body = {"case_type_id": _case_type(client, admin)["id"]} if typed else {}
    _rule(client, admin, **changes)

    response = client.post(
        f"{ADMIN}/sla-rules",
        json={"priority": "HIGH", "response_minutes": 10, "resolution_minutes": 60, **changes},
        headers=admin,
    )

    assert response.status_code == 409


def test_resolution_shorter_than_response_is_422(client: TestClient, admin: Headers) -> None:
    response = client.post(
        f"{ADMIN}/sla-rules",
        json={"priority": "LOW", "response_minutes": 120, "resolution_minutes": 60},
        headers=admin,
    )

    assert response.status_code == 422


def test_rule_update_and_deactivation(client: TestClient, admin: Headers) -> None:
    created = _rule(client, admin)

    response = client.patch(
        f"{ADMIN}/sla-rules/{created['id']}",
        json={"resolution_minutes": 480, "is_active": False},
        headers=admin,
    )

    assert response.status_code == 200, response.text
    assert response.json()["resolution_minutes"] == 480
    assert response.json()["is_active"] is False


def test_update_cannot_make_resolution_shorter_than_response(
    client: TestClient, admin: Headers
) -> None:
    created = _rule(client, admin)

    response = client.patch(
        f"{ADMIN}/sla-rules/{created['id']}", json={"resolution_minutes": 10}, headers=admin
    )

    assert response.status_code == 422


def test_rule_for_another_organizations_case_type_is_404(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    foreign = _case_type(client, other_admin)

    response = client.post(
        f"{ADMIN}/sla-rules",
        json={
            "priority": "HIGH",
            "response_minutes": 30,
            "resolution_minutes": 240,
            "case_type_id": foreign["id"],
        },
        headers=admin,
    )

    assert response.status_code == 404


# --- Agent politikalari -------------------------------------------------------------------


def test_policy_update(client: TestClient, admin: Headers) -> None:
    _case_type(client, admin)
    policy = client.get(f"{ADMIN}/agent-policies", headers=admin).json()["items"][0]

    response = client.patch(
        f"{ADMIN}/agent-policies/{policy['id']}",
        json={"autonomy_level": "L1_AUTONOMOUS", "min_confidence_auto": 0.85},
        headers=admin,
    )

    assert response.status_code == 200, response.text
    assert response.json()["autonomy_level"] == "L1_AUTONOMOUS"
    assert response.json()["min_confidence_auto"] == pytest.approx(0.85)
    assert response.json()["notify_manager"] is True


def test_confidence_above_one_is_422(client: TestClient, admin: Headers) -> None:
    _case_type(client, admin)
    policy = client.get(f"{ADMIN}/agent-policies", headers=admin).json()["items"][0]

    response = client.patch(
        f"{ADMIN}/agent-policies/{policy['id']}", json={"min_confidence_auto": 1.5}, headers=admin
    )

    assert response.status_code == 422


def test_policy_of_another_organization_is_404(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    _case_type(client, other_admin)
    foreign = client.get(f"{ADMIN}/agent-policies", headers=other_admin).json()["items"][0]

    response = client.patch(
        f"{ADMIN}/agent-policies/{foreign['id']}", json={"notify_manager": False}, headers=admin
    )

    assert response.status_code == 404


# --- Yetki --------------------------------------------------------------------------------


@pytest.mark.parametrize("path", ["case-types", "sla-rules", "agent-policies"])
def test_manager_cannot_manage_definitions(
    client: TestClient, db_session: Session, path: str
) -> None:
    manager = login_headers(
        client, db_session, email="mudur@kampus-a.edu.tr", role=UserRole.MANAGER
    )

    assert client.get(f"{ADMIN}/{path}", headers=manager).status_code == 403
