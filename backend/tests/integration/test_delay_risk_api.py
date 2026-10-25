"""GET /analytics/delay-risk: acik bildirimler gecikme riskine gore, gerekceleriyle.

Gecmis: yogun birimde (Destek) acilan dusuk oncelikli bildirimler gecikmis, sakin birimde (Bakim)
acilan yuksek oncelikliler zamaninda bitmis. Acik iki bildirimden Destek'teki ust sirada olmali.
"""

from dataclasses import dataclass
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Case, Department, Location, Organization
from app.models.enums import CaseCategory, CaseStatus, Priority, UserRole
from tests.integration.conftest import FrozenClock
from tests.integration.factories import (
    bearer,
    make_department,
    make_location,
    make_organization,
    make_user,
)

URL = "/api/v1/analytics/delay-risk"
Headers = dict[str, str]
HISTORY = 60


@dataclass
class Campus:
    session: Session
    organization: Organization
    support: Department
    maintenance: Department
    location: Location
    reporter_id: int
    manager: Headers
    clock: FrozenClock
    numbers: list[int]


@pytest.fixture
def campus(client: TestClient, db_session: Session, clock: FrozenClock) -> Campus:
    organization = make_organization(db_session)
    reporter = make_user(db_session, email="ogrenci@kampus-a.edu.tr", organization=organization)
    make_user(
        db_session, email="mudur@kampus-a.edu.tr", role=UserRole.MANAGER, organization=organization
    )
    make_user(
        db_session, email="personel@kampus-a.edu.tr", role=UserRole.STAFF, organization=organization
    )
    return Campus(
        session=db_session,
        organization=organization,
        support=make_department(db_session, organization, "SUPPORT_SERVICES"),
        maintenance=make_department(db_session, organization, "MAINTENANCE"),
        location=make_location(db_session, organization),
        reporter_id=reporter.id,
        manager=bearer(client, "mudur@kampus-a.edu.tr"),
        clock=clock,
        numbers=[0],
    )


def _case(campus: Campus, department: Department, hours_ago: float, **fields: object) -> Case:
    campus.numbers[0] += 1
    created = campus.clock.now() - timedelta(hours=hours_ago)
    case = Case(
        organization_id=campus.organization.id,
        case_number=f"CASE-{campus.numbers[0]:06d}",
        title=f"Bildirim {campus.numbers[0]}",
        description="Gecikme riski deneme bildirimi",
        reporter_id=campus.reporter_id,
        location_id=campus.location.id,
        department_id=department.id,
        category=CaseCategory.CONSUMABLE,
        created_at=created,
        due_at=created + timedelta(hours=4),
        **fields,
    )
    campus.session.add(case)
    return case


def _history(campus: Campus) -> None:
    # Her 6 saatte bir bildirim; Destek'tekiler hedeften 2 saat sonra, Bakim'dakiler 1 saatte biter
    for index in range(HISTORY):
        busy = index % 2 == 0
        hours_ago = 24 * 30 - index * 6
        late = busy if index % 10 else not busy
        _case(
            campus,
            campus.support if busy else campus.maintenance,
            hours_ago,
            status=CaseStatus.CLOSED,
            priority=Priority.LOW if busy else Priority.HIGH,
            resolved_at=campus.clock.now() - timedelta(hours=hours_ago - (6 if late else 1)),
        )


def _open(campus: Campus) -> tuple[Case, Case]:
    risky = _case(campus, campus.support, 1, status=CaseStatus.ASSIGNED, priority=Priority.LOW)
    calm = _case(campus, campus.maintenance, 1, status=CaseStatus.ASSIGNED, priority=Priority.HIGH)
    # Suresi zaten asilmis acik bildirim listeye girmez, sayisi ayrica doner
    _case(campus, campus.support, 10, status=CaseStatus.ASSIGNED, priority=Priority.LOW)
    campus.session.flush()
    return risky, calm


def test_open_cases_are_ranked_by_delay_risk(client: TestClient, campus: Campus) -> None:
    _history(campus)
    risky, calm = _open(campus)

    body = client.get(URL, headers=campus.manager).json()

    assert [item["case_id"] for item in body["items"]] == [risky.id, calm.id]
    first, second = body["items"]
    assert first["risk_pct"] > second["risk_pct"]
    assert first["level"] in {"HIGH", "MEDIUM"}
    assert first["case_number"] == risky.case_number
    assert first["department_name"] == "SUPPORT_SERVICES"
    assert first["factors"], "gerekce olmali"
    assert all(isinstance(f["label"], str) and f["label"] for f in first["factors"])
    assert body["already_late"] == 1


def test_model_quality_is_reported(client: TestClient, campus: Campus) -> None:
    _history(campus)
    _open(campus)

    model = client.get(URL, headers=campus.manager).json()["model"]

    assert model["train_cases"] + model["test_cases"] == HISTORY
    assert model["auc"] is not None and model["auc"] > 0.7
    assert 0 < model["late_share_pct"] < 100


def test_without_enough_history_there_is_no_ranking(client: TestClient, campus: Campus) -> None:
    _open(campus)

    body = client.get(URL, headers=campus.manager).json()

    assert body["model"] is None
    assert body["items"] == []
    assert body["message"]


def test_staff_cannot_see_the_risk_list(client: TestClient, campus: Campus) -> None:
    staff = bearer(client, "personel@kampus-a.edu.tr")

    assert client.get(URL, headers=staff).status_code == 403
