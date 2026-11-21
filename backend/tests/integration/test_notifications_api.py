"""Kisiye ozel bildirimler (docs/API.md "Notifications"): olay kaydi yazilirken alicilar belirlenir.

Kurallar: yeni gorev -> atanan personel (havuzsa birimin personeli); kapanan/reddedilen bildirim ve
ek bilgi talebi -> bildirim yapan; reddedilen gorev ve SLA asimi -> birimin muduru; yorum -> diger
taraflar (ic not bildirim yapana gitmez). Olayi yapan kisi kendine bildirim almaz.
"""

from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Case
from app.models.enums import CaseStatus, UserRole
from tests.integration.factories import (
    bearer,
    make_department,
    make_location,
    make_organization,
    make_user,
)

Headers = dict[str, str]
URL = "/api/v1/notifications"


@dataclass
class World:
    case_id: int
    location_id: int
    department_id: int
    headers: dict[str, Headers]
    ids: dict[str, int]

    def __getitem__(self, name: str) -> Headers:
        return self.headers[name]


@pytest.fixture
def world(client: TestClient, db_session: Session) -> World:
    organization = make_organization(db_session)
    support = make_department(db_session, organization, "SUPPORT_SERVICES")
    other = make_department(db_session, organization, "MAINTENANCE")
    people = {
        "ogrenci": (UserRole.REPORTER, None),
        "ogrenci2": (UserRole.REPORTER, None),
        "ogrenci3": (UserRole.REPORTER, None),
        "temizlik": (UserRole.STAFF, support.id),
        "temizlik2": (UserRole.STAFF, support.id),
        "teknisyen": (UserRole.STAFF, other.id),
        "mudur": (UserRole.MANAGER, support.id),
        "bakim_muduru": (UserRole.MANAGER, other.id),
    }
    ids = {
        name: make_user(
            db_session,
            email=f"{name}@kampus.edu.tr",
            role=role,
            organization=organization,
            department_id=department_id,
        ).id
        for name, (role, department_id) in people.items()
    }
    headers = {name: bearer(client, f"{name}@kampus.edu.tr") for name in people}
    location_id = make_location(db_session, organization).id
    body = {"description": "Tuvalette sabunluk tamamen boş.", "location_id": location_id}
    created = client.post("/api/v1/cases", json=body, headers=headers["ogrenci"]).json()
    return World(created["id"], location_id, support.id, headers, ids)


def _assign(client: TestClient, world: World, user: str | None) -> None:
    body: dict[str, object] = {"department_id": world.department_id}
    if user is not None:
        body["user_id"] = world.ids[user]
    url = f"/api/v1/cases/{world.case_id}/assign"
    assert client.post(url, json=body, headers=world["mudur"]).status_code == 200


def _mine(client: TestClient, headers: Headers) -> list[dict]:
    response = client.get(URL, headers=headers)
    assert response.status_code == 200, response.text
    items: list[dict] = response.json()["items"]
    return items


def _unread(client: TestClient, headers: Headers) -> int:
    count: int = client.get(f"{URL}/unread-count", headers=headers).json()["count"]
    return count


def _task_id(client: TestClient, headers: Headers) -> int:
    [task] = client.get("/api/v1/tasks/mine", headers=headers).json()["items"]
    task_id: int = task["id"]
    return task_id


def test_assigned_staff_is_notified_of_the_new_task(client: TestClient, world: World) -> None:
    _assign(client, world, "temizlik")

    [item] = _mine(client, world["temizlik"])
    assert item["case_id"] == world.case_id
    assert item["event_type"] == "TASK_CREATED"
    assert "görev" in item["message"].lower()
    assert item["read_at"] is None
    assert _unread(client, world["temizlik"]) == 1
    # Baska personel, bildirim yapan ve atamayi yapan mudur bildirim almaz
    assert _mine(client, world["temizlik2"]) == []
    assert _mine(client, world["ogrenci"]) == []
    assert _mine(client, world["mudur"]) == []


def test_pool_task_notifies_every_staff_of_the_department(client: TestClient, world: World) -> None:
    _assign(client, world, None)

    assert _unread(client, world["temizlik"]) == 1
    assert _unread(client, world["temizlik2"]) == 1
    assert _unread(client, world["teknisyen"]) == 0


def _close(client: TestClient, world: World) -> None:
    _assign(client, world, "temizlik")
    _finish(client, world)


def _finish(client: TestClient, world: World) -> None:
    task_id = _task_id(client, world["temizlik"])
    for action in ("accept", "start", "complete"):
        url = f"/api/v1/tasks/{task_id}/{action}"
        assert client.post(url, json={}, headers=world["temizlik"]).status_code == 200
    closed = client.post(
        f"/api/v1/cases/{world.case_id}/close",
        json={"reason": "Kontrol edildi."},
        headers=world["mudur"],
    )
    assert closed.status_code == 200


def _report(client: TestClient, world: World, reporter: str) -> int:
    body = {
        "description": "Tuvaletteki sabunluk yine boş kalmış.",
        "location_id": world.location_id,
    }
    case_id: int = client.post("/api/v1/cases", json=body, headers=world[reporter]).json()["id"]
    return case_id


def _merge(client: TestClient, world: World, case_id: int, into: int) -> None:
    merged = client.post(
        f"/api/v1/cases/{case_id}/merge",
        json={"parent_case_id": into, "reason": "Aynı sabunluk."},
        headers=world["mudur"],
    )
    assert merged.status_code == 200, merged.text


def test_reporter_hears_when_the_case_is_closed(client: TestClient, world: World) -> None:
    _close(client, world)

    events = [n["event_type"] for n in _mine(client, world["ogrenci"])]
    assert "CASE_CLOSED" in events


def test_manager_of_the_department_hears_a_declined_task(client: TestClient, world: World) -> None:
    _assign(client, world, "temizlik")
    task_id = _task_id(client, world["temizlik"])

    url = f"/api/v1/tasks/{task_id}/decline"
    client.post(url, json={"reason": "Yetkim dışında."}, headers=world["temizlik"])

    [item] = _mine(client, world["mudur"])
    assert item["event_type"] == "TASK_DECLINED"
    assert _mine(client, world["bakim_muduru"]) == []


def test_public_comment_reaches_the_other_side_but_internal_note_does_not(
    client: TestClient, world: World
) -> None:
    _assign(client, world, "temizlik")
    comments = f"/api/v1/cases/{world.case_id}/comments"

    client.post(comments, json={"body": "Yarın sabah bakıyorum."}, headers=world["temizlik"])
    client.post(
        comments, json={"body": "Malzeme sor.", "is_internal": True}, headers=world["temizlik"]
    )
    client.post(comments, json={"body": "Teşekkürler!"}, headers=world["ogrenci"])

    reporter = [n["event_type"] for n in _mine(client, world["ogrenci"])]
    staff = [n["event_type"] for n in _mine(client, world["temizlik"])]
    assert reporter == ["COMMENT_ADDED"]
    # Personel: gorev + bildirim yapanin yorumu (yeniden eskiye)
    assert staff == ["COMMENT_ADDED", "TASK_CREATED"]


def test_marking_read_one_by_one_and_all_at_once(client: TestClient, world: World) -> None:
    _assign(client, world, "temizlik")
    comments = f"/api/v1/cases/{world.case_id}/comments"
    client.post(comments, json={"body": "Ne zaman gelinir?"}, headers=world["ogrenci"])
    first, second = _mine(client, world["temizlik"])

    one = client.post(f"{URL}/{first['id']}/read", headers=world["temizlik"])

    assert one.status_code == 204
    assert _unread(client, world["temizlik"]) == 1
    assert client.post(f"{URL}/read-all", headers=world["temizlik"]).status_code == 204
    assert _unread(client, world["temizlik"]) == 0
    assert all(n["read_at"] is not None for n in _mine(client, world["temizlik"]))
    # Baskasinin bildirimi yok sayilir (IDOR: 404)
    stranger = client.post(f"{URL}/{second['id']}/read", headers=world["temizlik2"])
    assert stranger.status_code == 404


def test_unread_only_filter_and_login_required(client: TestClient, world: World) -> None:
    _assign(client, world, None)
    [item] = _mine(client, world["temizlik"])
    client.post(f"{URL}/{item['id']}/read", headers=world["temizlik"])

    unread = client.get(URL, params={"unread_only": True}, headers=world["temizlik"]).json()

    assert unread["items"] == []
    assert unread["total"] == 0
    assert client.get(URL).status_code == 401


def test_only_the_merged_report_hears_about_the_merge(client: TestClient, world: World) -> None:
    _assign(client, world, "temizlik")
    _merge(client, world, _report(client, world, "ogrenci2"), into=world.case_id)

    assert [n["event_type"] for n in _mine(client, world["ogrenci2"])] == ["CASE_MERGED"]
    # Ana bildirimin sahibinin kaydi birlesmedi; ona "birlestirildi" denmez
    assert "CASE_MERGED" not in [n["event_type"] for n in _mine(client, world["ogrenci"])]


def test_reporters_of_merged_reports_hear_when_the_main_report_is_closed(
    client: TestClient, world: World, db_session: Session
) -> None:
    _assign(client, world, "temizlik")
    # Zincir: ilk kayit ara kayda, ara kayit da sonra ana kayda baglanir
    middle = _report(client, world, "ogrenci2")
    middle_case = db_session.get(Case, middle)
    assert middle_case is not None
    # Agent hatti testte kapali; ara kayit siniflandirilmis olmali ki ona baglanilabilsin
    middle_case.status = CaseStatus.CLASSIFIED
    db_session.flush()
    first = _report(client, world, "ogrenci3")
    _merge(client, world, first, into=middle)
    middle_case.status = CaseStatus.ANALYZING
    db_session.flush()
    _merge(client, world, middle, into=world.case_id)

    _finish(client, world)

    for reporter, own_case in (("ogrenci2", middle), ("ogrenci3", first)):
        closed = [n for n in _mine(client, world[reporter]) if n["event_type"] == "CASE_CLOSED"]
        # Bildirim kisinin kendi kaydina baglanir; ana kaydi goremez (404)
        assert [n["case_id"] for n in closed] == [own_case], reporter
        assert "çözüldü" in closed[0]["message"]
        detail = client.get(f"/api/v1/cases/{own_case}", headers=world[reporter])
        assert detail.status_code == 200
