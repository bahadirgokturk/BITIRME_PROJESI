"""agent_decisions: her agent karari girdisi, gerekcesi ve ciktisiyla saklanir."""

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.agents.base import AgentContext
from app.agents.priority import PriorityAgent, PriorityInput
from app.models import Case
from app.models.enums import CaseStatus, Priority
from app.repositories import agent_decision_repository
from app.repositories.agent_decision_repository import DecisionRun
from tests.integration.factories import make_location, make_organization, make_user

CTX = AgentContext(now=datetime(2026, 10, 7, 7, 0, tzinfo=UTC))


def _case(session: Session) -> Case:
    organization = make_organization(session)
    reporter = make_user(session, email="ogrenci@kampus-a.edu.tr", organization=organization)
    case = Case(
        organization_id=organization.id,
        case_number="CASE-000001",
        title="Sabun yok",
        description="Tuvalette sabun bitmis.",
        reporter_id=reporter.id,
        location_id=make_location(session, organization).id,
        status=CaseStatus.ANALYZING,
        created_at=CTX.now,
    )
    session.add(case)
    session.flush()
    return case


def test_a_decision_is_stored_with_its_input_reasons_and_output(db_session: Session) -> None:
    case = _case(db_session)
    inp = PriorityInput(
        base_severity=20,
        base_priority=Priority.LOW,
        is_safety_related=False,
        safety_signal=False,
        urgency_hints=[],
        location_importance=60,
    )
    result = PriorityAgent().run(inp, CTX)
    run_id = uuid.uuid4()

    run = DecisionRun(case_id=case.id, run_id=run_id, at=CTX.now)
    agent_decision_repository.record(db_session, run, inp, result)
    stored = agent_decision_repository.list_for_case(db_session, case.id)

    assert len(stored) == 1
    decision = stored[0]
    assert (decision.agent_name, decision.decision, decision.run_id) == ("priority", "LOW", run_id)
    assert decision.input_snapshot["location_importance"] == 60
    assert decision.output_json["impact_score"] == 22
    assert decision.reason_json[0]["code"] == "SEVERITY"
    assert decision.model == "rules@1.0"
