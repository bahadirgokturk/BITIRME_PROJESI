"""Agent performans metrikleri (E6-5; docs/ANALYTICS.md bolum 3, RQ1-RQ3).

Saat 26.09.2026 15:00 (Istanbul), donem 20-26.09. Kararlar (bildirimin son turu parantezde):

  c1 SABUN  siniflandirma SOAP 0,9 (dogru), oncelik MEDIUM, supervisor AUTO_ASSIGN
  c2 SABUN  siniflandirma PROJ 0,5 (yanlis; manager duzeltti), supervisor SEND_TO_HUMAN_REVIEW
  c3 PROJ   siniflandirma PROJ 0,8, tekrar DUPLICATE -> birlestirildi
  c4 PROJ   siniflandirma PROJ 0,7, tekrar POSSIBLE_DUPLICATE -> manager birlestirmedi
  c5 SABUN  tekrar POSSIBLE_DUPLICATE -> manager birlestirdi
  c6 SABUN  15.09 (onceki donem): siniflandirma PROJ (yanlis) -> sayilmaz
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import CaseStatus
from tests.integration.analytics_world import (
    World,
    add_case,
    add_decision,
    add_feedback,
    add_supervisor,
    build_world,
    projector,
    soap,
    tr,
)
from tests.integration.conftest import FrozenClock


def _add_decisions(session: Session, world: World) -> None:
    c1 = add_case(session, world, tr(21, 10), **soap(world, tr(21, 10)), status=CaseStatus.ASSIGNED)
    add_decision(session, c1, "classification", "SOAP", confidence="0.9")
    add_decision(session, c1, "priority", "MEDIUM")
    add_supervisor(session, c1, "AUTO_ASSIGN")

    c2 = add_case(session, world, tr(22, 9), **soap(world, tr(22, 9)), status=CaseStatus.ASSIGNED)
    wrong = add_decision(session, c2, "classification", "PROJ", confidence="0.5")
    add_feedback(session, wrong, "case_type", "SOAP")
    add_supervisor(session, c2, "SEND_TO_HUMAN_REVIEW")

    c3 = add_case(session, world, tr(23, 9), **projector(world), status=CaseStatus.MERGED)
    add_decision(session, c3, "classification", "PROJ", confidence="0.8")
    add_decision(session, c3, "duplicate", "DUPLICATE")

    c4 = add_case(session, world, tr(24, 9), **projector(world), status=CaseStatus.ASSIGNED)
    add_decision(session, c4, "classification", "PROJ", confidence="0.7")
    add_decision(session, c4, "duplicate", "POSSIBLE_DUPLICATE")

    c5 = add_case(session, world, tr(25, 9), **soap(world, tr(25, 9)), status=CaseStatus.MERGED)
    add_decision(session, c5, "duplicate", "POSSIBLE_DUPLICATE")

    c6 = add_case(session, world, tr(15, 9), **soap(world, tr(15, 9)), status=CaseStatus.ASSIGNED)
    add_decision(session, c6, "classification", "PROJ", confidence="0.4")
    session.flush()


@pytest.fixture
def world(client: TestClient, db_session: Session, clock: FrozenClock) -> World:
    world = build_world(client, db_session, clock)
    _add_decisions(db_session, world)
    return world


def metrics(client: TestClient, world: World, **params: Any) -> Any:
    response = client.get("/api/v1/agents/metrics", params=params, headers=world.headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_classification_accuracy_compares_with_the_final_type(
    client: TestClient, world: World
) -> None:
    body = metrics(client, world)

    # c1 c3 c4 dogru, c2 duzeltildi; c6 donem disi
    assert body["classification_accuracy_pct"] == 75.0
    assert body["period"] == {"from": "2026-09-20", "to": "2026-09-26"}


def test_duplicate_precision_counts_confirmed_merges(client: TestClient, world: World) -> None:
    body = metrics(client, world)

    # Isaretlenen c3 c4 c5; birlestirilen c3 c5
    assert body["duplicate_precision_pct"] == 66.7


def test_automation_and_human_review_share(client: TestClient, world: World) -> None:
    body = metrics(client, world)

    # Supervisor'dan gecen c1 (otomatik) ve c2 (incelemeye)
    assert body["automation_pct"] == 50.0
    assert body["human_review_pct"] == 50.0


def test_per_agent_decisions_confidence_and_overrides(client: TestClient, world: World) -> None:
    body = metrics(client, world)

    rows = {row["agent"]: row for row in body["agents"]}
    # Hat sirasiyla, yalniz donemde karari olan agent'lar
    assert list(rows) == ["classification", "duplicate", "priority", "supervisor"]
    assert rows["classification"] == {
        "agent": "classification",
        "label": "Sınıflandırma",
        "decisions": 4,
        "avg_confidence": 0.725,
        "override_rate_pct": 25.0,
    }
    assert rows["duplicate"]["avg_confidence"] is None
    assert rows["priority"]["override_rate_pct"] == 0.0


def test_empty_period_has_no_metrics(client: TestClient, world: World) -> None:
    body = metrics(client, world, **{"from": "2026-07-01", "to": "2026-07-07"})

    assert body["agents"] == []
    assert body["classification_accuracy_pct"] is None
    assert body["duplicate_precision_pct"] is None
