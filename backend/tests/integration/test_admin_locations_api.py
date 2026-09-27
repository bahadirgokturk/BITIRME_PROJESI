"""Admin lokasyon yonetimi: agac, materialized path, dongu engeli, kurum kapsami."""

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy.orm import Session

from tests.integration.factories import login_headers

URL = "/api/v1/admin/locations"
Headers = dict[str, str]


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> Headers:
    return login_headers(client, db_session, email="admin@kampus-a.edu.tr")


@pytest.fixture
def other_admin(client: TestClient, db_session: Session) -> Headers:
    return login_headers(client, db_session, email="admin@kampus-b.edu.tr")


def _create(
    client: TestClient, headers: Headers, code: str, parent_id: object = None
) -> dict[str, object]:
    payload = {"kind": "BUILDING", "code": code, "name": code, "parent_id": parent_id}
    response = client.post(URL, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    body: dict[str, object] = response.json()
    return body


def _patch(
    client: TestClient, headers: Headers, location_id: object, payload: dict[str, object]
) -> Response:
    return client.patch(f"{URL}/{location_id}", json=payload, headers=headers)


def test_root_location_path_is_its_code(client: TestClient, admin: Headers) -> None:
    campus = _create(client, admin, "KMP")

    assert campus["path"] == "KMP"
    assert campus["importance_weight"] == 50


def test_child_path_extends_parent_path(client: TestClient, admin: Headers) -> None:
    campus = _create(client, admin, "KMP")
    building = _create(client, admin, "B", parent_id=campus["id"])
    floor = _create(client, admin, "B-2", parent_id=building["id"])

    assert floor["path"] == "KMP/B/B-2"


def test_list_is_ordered_as_a_tree(client: TestClient, admin: Headers) -> None:
    campus = _create(client, admin, "KMP")
    _create(client, admin, "C", parent_id=campus["id"])
    building = _create(client, admin, "B", parent_id=campus["id"])
    _create(client, admin, "B-1", parent_id=building["id"])

    paths = [item["path"] for item in client.get(URL, headers=admin).json()["items"]]

    assert paths == ["KMP", "KMP/B", "KMP/B/B-1", "KMP/C"]


def test_moving_a_location_updates_its_whole_subtree(client: TestClient, admin: Headers) -> None:
    campus = _create(client, admin, "KMP")
    old_building = _create(client, admin, "A", parent_id=campus["id"])
    new_building = _create(client, admin, "B", parent_id=campus["id"])
    floor = _create(client, admin, "F2", parent_id=old_building["id"])
    room = _create(client, admin, "R201", parent_id=floor["id"])

    moved = _patch(client, admin, floor["id"], {"parent_id": new_building["id"]})

    assert moved.status_code == 200
    assert moved.json()["path"] == "KMP/B/F2"
    paths = {item["id"]: item["path"] for item in client.get(URL, headers=admin).json()["items"]}
    assert paths[room["id"]] == "KMP/B/F2/R201"


def test_moving_to_root_with_explicit_null(client: TestClient, admin: Headers) -> None:
    campus = _create(client, admin, "KMP")
    building = _create(client, admin, "B", parent_id=campus["id"])

    moved = _patch(client, admin, building["id"], {"parent_id": None})

    assert moved.json()["path"] == "B"
    assert moved.json()["parent_id"] is None


def test_location_cannot_be_moved_under_its_own_child(client: TestClient, admin: Headers) -> None:
    # Dongu olusursa agac sonsuz olur ve bina/kat analizleri bozulur
    campus = _create(client, admin, "KMP")
    building = _create(client, admin, "B", parent_id=campus["id"])

    response = _patch(client, admin, campus["id"], {"parent_id": building["id"]})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_PARENT"


def test_location_cannot_be_its_own_parent(client: TestClient, admin: Headers) -> None:
    campus = _create(client, admin, "KMP")

    response = _patch(client, admin, campus["id"], {"parent_id": campus["id"]})

    assert response.status_code == 422


def test_duplicate_code_is_409(client: TestClient, admin: Headers) -> None:
    _create(client, admin, "KMP")

    response = client.post(URL, json={"kind": "CAMPUS", "code": "KMP", "name": "x"}, headers=admin)

    assert response.status_code == 409


def test_parent_from_another_organization_is_404(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    foreign = _create(client, other_admin, "KMP")
    payload = {"kind": "BUILDING", "code": "B", "name": "B", "parent_id": foreign["id"]}

    response = client.post(URL, json=payload, headers=admin)

    assert response.status_code == 404


def test_updating_another_organizations_location_is_404(
    client: TestClient, admin: Headers, other_admin: Headers
) -> None:
    foreign = _create(client, other_admin, "KMP")

    assert _patch(client, admin, foreign["id"], {"name": "x"}).status_code == 404


def test_update_weight_aliases_and_deactivate(client: TestClient, admin: Headers) -> None:
    campus = _create(client, admin, "KMP")

    body = _patch(
        client,
        admin,
        campus["id"],
        {"importance_weight": 90, "aliases": ["merkez"], "is_active": False},
    ).json()

    assert (body["importance_weight"], body["aliases"], body["is_active"]) == (
        90,
        ["merkez"],
        False,
    )
