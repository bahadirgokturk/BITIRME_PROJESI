"""Yorum, geri bildirim ve yeniden acma (E3-5). Yetki: docs/WORKFLOW.md bolum 4."""

from dataclasses import dataclass
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.constants import REOPEN_WINDOW_HOURS
from app.models import Case
from app.models.enums import ActorType, CaseEventType, CaseStatus, UserRole
from app.services.workflow import Transition, WorkflowService
from tests.integration.conftest import FrozenClock
from tests.integration.factories import (
    bearer,
    make_department,
    make_location,
    make_organization,
    make_user,
)

Headers = dict[str, str]
SYSTEM = Transition(event_type=CaseEventType.WORK_COMPLETED, actor_type=ActorType.SYSTEM)
TO_CLOSED = (
    CaseStatus.CLASSIFIED,
    CaseStatus.ASSIGNED,
    CaseStatus.ACCEPTED,
    CaseStatus.IN_PROGRESS,
    CaseStatus.RESOLVED,
    CaseStatus.VERIFICATION,
    CaseStatus.CLOSED,
)


@dataclass
class World:
    case_id: int
    reporter: Headers
    stranger: Headers
    staff: Headers
    manager: Headers
    admin: Headers

    def relogin(self, client: TestClient) -> None:
        """Saat ileri alininca 30 dk'lik access token'lar da biter; yeniden giris yapilir."""
        for name in ("reporter", "manager"):
            email = {"reporter": "ogrenci", "manager": "mudur"}[name]
            setattr(self, name, bearer(client, f"{email}@kampus-a.edu.tr"))


@pytest.fixture
def world(client: TestClient, db_session: Session) -> World:
    organization = make_organization(db_session)
    department = make_department(db_session, organization, "SUPPORT_SERVICES")
    users = [
        ("ogrenci", UserRole.REPORTER, None),
        ("baska", UserRole.REPORTER, None),
        ("temizlik", UserRole.STAFF, department.id),
        ("mudur", UserRole.MANAGER, department.id),
        ("admin", UserRole.ADMIN, None),
    ]
    for name, role, department_id in users:
        make_user(
            db_session,
            email=f"{name}@kampus-a.edu.tr",
            role=role,
            organization=organization,
            department_id=department_id,
        )
    headers = {name: bearer(client, f"{name}@kampus-a.edu.tr") for name, _, _ in users}
    body = {"description": "Tuvalette sabunluk tamamen boş.", "location_id": 0}
    body["location_id"] = make_location(db_session, organization).id
    created = client.post("/api/v1/cases", json=body, headers=headers["ogrenci"]).json()
    case = db_session.get(Case, created["id"])
    assert case is not None
    case.department_id = department.id
    return World(
        case_id=case.id,
        reporter=headers["ogrenci"],
        stranger=headers["baska"],
        staff=headers["temizlik"],
        manager=headers["mudur"],
        admin=headers["admin"],
    )


def _close(db_session: Session, clock: FrozenClock, case_id: int) -> None:
    case = db_session.get(Case, case_id)
    assert case is not None
    workflow = WorkflowService(db_session, clock)
    for status in TO_CLOSED:
        workflow.transition(case, status, SYSTEM)
    db_session.flush()


def _comment(client: TestClient, world: World, headers: Headers, *, internal: bool = False) -> int:
    body = {"body": "Ekip yolda, 10 dk içinde orada.", "is_internal": internal}
    return client.post(
        f"/api/v1/cases/{world.case_id}/comments", json=body, headers=headers
    ).status_code


# --- Yorumlar ---------------------------------------------------------------------------


def test_reporter_and_staff_talk_publicly(client: TestClient, world: World) -> None:
    assert _comment(client, world, world.reporter) == 201
    assert _comment(client, world, world.staff) == 201

    comments = client.get(f"/api/v1/cases/{world.case_id}/comments", headers=world.reporter).json()

    assert len(comments) == 2
    assert comments[0]["author_name"]


def test_internal_notes_are_hidden_from_the_reporter(client: TestClient, world: World) -> None:
    assert _comment(client, world, world.staff, internal=True) == 201
    assert _comment(client, world, world.manager) == 201

    reporter_view = client.get(f"/api/v1/cases/{world.case_id}/comments", headers=world.reporter)
    manager_view = client.get(f"/api/v1/cases/{world.case_id}/comments", headers=world.manager)

    assert [c["is_internal"] for c in reporter_view.json()] == [False]
    assert len(manager_view.json()) == 2


def test_reporter_cannot_write_internal_notes(client: TestClient, world: World) -> None:
    assert _comment(client, world, world.reporter, internal=True) == 403


def test_admin_does_not_comment(client: TestClient, world: World) -> None:
    # Gorev ayriligi: admin operasyona karismaz
    assert _comment(client, world, world.admin) == 403


def test_stranger_cannot_see_or_write_comments(client: TestClient, world: World) -> None:
    assert _comment(client, world, world.stranger) == 404
    response = client.get(f"/api/v1/cases/{world.case_id}/comments", headers=world.stranger)
    assert response.status_code == 404


def test_empty_comment_is_422(client: TestClient, world: World) -> None:
    response = client.post(
        f"/api/v1/cases/{world.case_id}/comments", json={"body": "  "}, headers=world.reporter
    )

    assert response.status_code == 422


# --- Geri bildirim ------------------------------------------------------------------------


def _feedback(client: TestClient, world: World, headers: Headers, rating: int = 5) -> int:
    body = {"rating": rating, "comment": "Hızlı çözüldü, teşekkürler."}
    return client.post(
        f"/api/v1/cases/{world.case_id}/feedback", json=body, headers=headers
    ).status_code


def test_reporter_rates_a_closed_case_once(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    _close(db_session, clock, world.case_id)

    assert _feedback(client, world, world.reporter) == 200
    assert _feedback(client, world, world.reporter) == 409

    case = client.get(f"/api/v1/cases/{world.case_id}", headers=world.manager).json()
    assert case["satisfaction_rating"] == 5


def test_open_case_cannot_be_rated(client: TestClient, world: World) -> None:
    assert _feedback(client, world, world.reporter) == 409


def test_only_the_reporter_rates(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    _close(db_session, clock, world.case_id)

    assert _feedback(client, world, world.manager) == 403
    assert _feedback(client, world, world.stranger) == 404


def test_rating_must_be_one_to_five(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    _close(db_session, clock, world.case_id)

    assert _feedback(client, world, world.reporter, rating=6) == 422


# --- Yeniden acma -------------------------------------------------------------------------


def _reopen(client: TestClient, world: World, headers: Headers) -> tuple[int, dict[str, object]]:
    body = {"reason": "Sabunluk yine boş, doldurulmamış."}
    response = client.post(f"/api/v1/cases/{world.case_id}/reopen", json=body, headers=headers)
    return response.status_code, response.json()


def test_reporter_reopens_within_the_window(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    _close(db_session, clock, world.case_id)
    clock.advance(timedelta(hours=REOPEN_WINDOW_HOURS - 1))
    world.relogin(client)

    status, case = _reopen(client, world, world.reporter)

    assert status == 200
    assert case["status"] == "REOPENED"
    assert case["reopened_count"] == 1
    events = client.get(f"/api/v1/cases/{world.case_id}/events", headers=world.reporter).json()
    assert events[-1]["event_type"] == "CASE_REOPENED"


def test_reporter_cannot_reopen_after_the_window(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    _close(db_session, clock, world.case_id)
    clock.advance(timedelta(hours=REOPEN_WINDOW_HOURS, seconds=1))
    world.relogin(client)

    status, body = _reopen(client, world, world.reporter)

    assert status == 409
    assert body["error"]["code"] == "REOPEN_WINDOW_CLOSED"


def test_manager_reopens_any_time(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    _close(db_session, clock, world.case_id)
    clock.advance(timedelta(days=30))
    world.relogin(client)

    assert _reopen(client, world, world.manager)[0] == 200


def test_staff_and_admin_cannot_reopen(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    _close(db_session, clock, world.case_id)

    assert _reopen(client, world, world.staff)[0] == 403
    assert _reopen(client, world, world.admin)[0] == 403


def test_open_case_cannot_be_reopened(client: TestClient, world: World) -> None:
    status, body = _reopen(client, world, world.reporter)

    assert status == 409
    assert body["error"]["code"] == "INVALID_TRANSITION"


def test_rating_window_closes_after_72_hours(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    _close(db_session, clock, world.case_id)
    clock.advance(timedelta(hours=REOPEN_WINDOW_HOURS, seconds=1))
    world.relogin(client)

    body = {"rating": 4}
    response = client.post(
        f"/api/v1/cases/{world.case_id}/feedback", json=body, headers=world.reporter
    )

    assert response.status_code == 409
    assert "puanlanabilir" in response.json()["error"]["message"]


def test_window_restarts_when_a_reopened_case_closes_again(
    client: TestClient, db_session: Session, clock: FrozenClock, world: World
) -> None:
    # Ikinci kapanistan sonra da 72 saat itiraz hakki olmali (ilk kapanistan degil)
    _close(db_session, clock, world.case_id)
    world.relogin(client)
    assert _reopen(client, world, world.reporter)[0] == 200
    clock.advance(timedelta(days=5))
    case = db_session.get(Case, world.case_id)
    assert case is not None
    workflow = WorkflowService(db_session, clock)
    for status in (CaseStatus.ASSIGNED, *TO_CLOSED[2:]):
        workflow.transition(case, status, SYSTEM)
    world.relogin(client)

    assert _reopen(client, world, world.reporter)[0] == 200
