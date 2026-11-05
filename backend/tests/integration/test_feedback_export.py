"""Ogrenen model (v2): mudurun tur duzeltmeleri egitim verisine donusur.

Her bildirimin en son tur duzeltmesi alinir; oncelik/birim duzeltmeleri modele girmez. Metin,
calisma aninda modele giden metinle aynidir (baslik + aciklama).
"""

import csv
import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Case
from app.models.enums import CaseStatus
from scripts.export_feedback import export
from tests.integration.analytics_world import (
    World,
    add_case,
    add_decision,
    add_feedback,
    build_world,
    soap,
    tr,
)
from tests.integration.conftest import FrozenClock


@pytest.fixture
def world(client: TestClient, db_session: Session, clock: FrozenClock) -> World:
    return build_world(client, db_session, clock)


def _case(session: Session, world: World, day: int, description: str) -> Case:
    fields = soap(world, tr(day, 10)) | {"status": CaseStatus.ASSIGNED}
    case = add_case(session, world, tr(day, 10), **fields)
    case.title, case.description = "Lavabo", description
    return case


def test_type_corrections_become_labelled_sentences(db_session: Session, world: World) -> None:
    fixed = _case(db_session, world, 20, "Sıvı sabun dispenseri boşalmış.")
    decision = add_decision(db_session, fixed, "classification", "WIFI_FAILURE")
    add_feedback(db_session, decision, "case_type", "SOAP_EMPTY")
    twice = _case(db_session, world, 21, "Projeksiyon değil, kumanda pili bitmiş.")
    first = add_decision(db_session, twice, "classification", "SOAP_EMPTY")
    add_feedback(db_session, first, "case_type", "PROJECTOR_FAILURE")
    later = add_decision(db_session, twice, "classification", "PROJECTOR_FAILURE")
    add_feedback(db_session, later, "case_type", "OTHER")
    priority_only = _case(db_session, world, 22, "Tuvalette sabun yok, acil değil.")
    add_feedback(
        db_session, add_decision(db_session, priority_only, "priority", "HIGH"), "priority", "LOW"
    )
    db_session.flush()

    out = io.StringIO()
    count = export(db_session, out)
    rows = list(csv.DictReader(io.StringIO(out.getvalue())))

    assert count == 2
    assert [(row["text"], row["label"]) for row in rows] == [
        ("Lavabo Sıvı sabun dispenseri boşalmış.", "SOAP_EMPTY"),
        # Ayni bildirim iki kez duzeltildiyse sonuncusu gecerli
        ("Lavabo Projeksiyon değil, kumanda pili bitmiş.", "OTHER"),
    ]
    assert rows[0]["case_number"].startswith("CASE-")


def test_no_corrections_no_rows(db_session: Session, world: World) -> None:
    out = io.StringIO()

    assert export(db_session, out) == 0
    assert out.getvalue().splitlines() == ["text,label,case_number,corrected_at"]
