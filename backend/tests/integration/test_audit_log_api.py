"""Denetim izi (E2-5, docs/DATABASE.md "audit_logs"): her admin degisikligi kaydedilir.

Ekleme: after tam kayit. Guncelleme: before/after yalniz degisen alanlar; degisiklik yoksa
kayit yok.
Parola ve hash hicbir zaman yazilmaz.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import UserRole
from tests.integration.factories import login_headers

ADMIN = "/api/v1/admin"
LOGS = f"{ADMIN}/audit-logs"
# make_user varsayilan adi
ADMIN_NAME = "Ayşe Yılmaz"
Headers = dict[str, str]
Body = dict[str, object]


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> Headers:
    return login_headers(client, db_session, email="admin@kampus-a.edu.tr")


def _post(client: TestClient, path: str, body: Body, headers: Headers) -> Body:
    response = client.post(f"{ADMIN}/{path}", json=body, headers=headers)
    assert response.status_code == 201, response.text
    created: Body = response.json()
    return created


def _patch(client: TestClient, path: str, body: Body, headers: Headers) -> None:
    response = client.patch(f"{ADMIN}/{path}", json=body, headers=headers)
    assert response.status_code == 200, response.text


def _logs(client: TestClient, headers: Headers, **params: object) -> list[Body]:
    response = client.get(LOGS, params=params, headers=headers)
    assert response.status_code == 200, response.text
    items: list[Body] = response.json()["items"]
    return items


def _department(client: TestClient, headers: Headers) -> Body:
    return _post(client, "departments", {"code": "SUPPORT_SERVICES", "name": "Destek"}, headers)


def test_creation_is_logged_with_actor_and_full_record(client: TestClient, admin: Headers) -> None:
    created = _department(client, admin)

    [entry] = _logs(client, admin)

    assert entry["action"] == "DEPARTMENT_CREATED"
    assert entry["entity_type"] == "DEPARTMENT"
    assert entry["entity_id"] == created["id"]
    assert entry["actor_name"] == ADMIN_NAME
    assert entry["before"] is None
    assert entry["after"] == created
    assert entry["ip_address"] == "testclient"


def test_update_keeps_only_the_changed_fields(client: TestClient, admin: Headers) -> None:
    created = _department(client, admin)

    _patch(client, f"departments/{created['id']}", {"name": "Destek Hizmetleri"}, admin)

    latest = _logs(client, admin)[0]
    assert latest["action"] == "DEPARTMENT_UPDATED"
    assert latest["before"] == {"name": "Destek"}
    assert latest["after"] == {"name": "Destek Hizmetleri"}


def test_update_without_a_real_change_is_not_logged(client: TestClient, admin: Headers) -> None:
    created = _department(client, admin)

    _patch(client, f"departments/{created['id']}", {"name": "Destek"}, admin)

    assert len(_logs(client, admin)) == 1


def test_password_never_reaches_the_log(client: TestClient, admin: Headers) -> None:
    secret = "cok-gizli-parola-123"
    _post(
        client,
        "users",
        {
            "email": "ogrenci@kampus-a.edu.tr",
            "full_name": "Öğrenci",
            "role": "REPORTER",
            "reporter_kind": "STUDENT",
            "password": secret,
        },
        admin,
    )

    [entry] = _logs(client, admin, entity_type="USER")

    assert entry["action"] == "USER_CREATED"
    assert secret not in str(entry)
    assert "password" not in str(entry)


def test_every_definition_change_is_logged(client: TestClient, admin: Headers) -> None:
    case_type = _post(
        client,
        "case-types",
        {
            "code": "SOAP_EMPTY",
            "name": "Sabun bitti",
            "category": "CONSUMABLE",
            "base_priority": "LOW",
            "base_severity": 20,
        },
        admin,
    )
    rule = _post(
        client,
        "sla-rules",
        {"priority": "LOW", "response_minutes": 60, "resolution_minutes": 480},
        admin,
    )
    location = _post(
        client, "locations", {"kind": "BUILDING", "code": "B", "name": "B Blok"}, admin
    )
    policy = client.get(f"{ADMIN}/agent-policies", headers=admin).json()["items"][0]
    _patch(client, f"sla-rules/{rule['id']}", {"resolution_minutes": 600}, admin)
    _patch(client, f"agent-policies/{policy['id']}", {"autonomy_level": "L1_AUTONOMOUS"}, admin)
    _patch(client, f"locations/{location['id']}", {"name": "B Blok (Mühendislik)"}, admin)

    actions = [entry["action"] for entry in _logs(client, admin)]

    assert actions == [
        "LOCATION_UPDATED",
        "AGENT_POLICY_UPDATED",
        "SLA_RULE_UPDATED",
        "LOCATION_CREATED",
        "SLA_RULE_CREATED",
        "CASE_TYPE_CREATED",
    ]
    policy_entry = _logs(client, admin, entity_type="AGENT_POLICY")[0]
    assert policy_entry["before"] == {"autonomy_level": "L2_NOTIFY"}
    assert case_type["id"] == _logs(client, admin, entity_type="CASE_TYPE")[0]["entity_id"]


def test_filter_by_entity(client: TestClient, admin: Headers) -> None:
    first = _department(client, admin)
    _post(client, "departments", {"code": "MAINTENANCE", "name": "Bakım"}, admin)

    entries = _logs(client, admin, entity_type="DEPARTMENT", entity_id=first["id"])

    assert [entry["entity_id"] for entry in entries] == [first["id"]]


def test_logs_of_another_organization_are_hidden(
    client: TestClient, db_session: Session, admin: Headers
) -> None:
    other = login_headers(client, db_session, email="admin@kampus-b.edu.tr")
    _department(client, other)

    assert _logs(client, admin) == []


def test_manager_cannot_read_the_log(client: TestClient, db_session: Session) -> None:
    manager = login_headers(
        client, db_session, email="mudur@kampus-a.edu.tr", role=UserRole.MANAGER
    )

    assert client.get(LOGS, headers=manager).status_code == 403
