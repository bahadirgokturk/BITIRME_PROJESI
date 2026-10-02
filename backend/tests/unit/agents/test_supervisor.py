"""Supervisor (AGENTS.md 4.7): deterministik karar tablosu, ilk eslesen kural kazanir."""

from datetime import UTC, datetime

import pytest

from app.agents.base import RULES_MODEL, AgentContext
from app.agents.supervisor import SupervisorAgent, SupervisorDecision, SupervisorInput
from app.models.enums import AutonomyLevel, Priority

CTX = AgentContext(now=datetime(2026, 10, 7, 7, 0, tzinfo=UTC))
# Her seyi otomatik atamaya uygun bir bildirim; testler tek bir alani bozar
ROUTINE = SupervisorInput(
    is_meaningful=True,
    verification_score=0.6,
    duplicate_probability=0.0,
    case_type_code="SOAP_EMPTY",
    autonomy=AutonomyLevel.L1_AUTONOMOUS,
    min_confidence_auto=0.7,
    classification_confidence=0.9,
    priority=Priority.LOW,
    safety_term=None,
    routing_decision="ASSIGN_STAFF",
)


def _decide(**changes: object) -> object:
    return SupervisorAgent().run(ROUTINE.model_copy(update=changes), CTX)


def test_routine_report_is_assigned_automatically() -> None:
    result = _decide()

    assert result.decision == "AUTO_ASSIGN"
    assert result.output.rule == 6
    assert result.output.needs_human_review is False
    assert result.output.notify_manager is False
    assert result.model == RULES_MODEL


@pytest.mark.parametrize(
    ("changes", "decision"),
    [
        ({"is_meaningful": False}, SupervisorDecision.REQUEST_MORE_INFO),
        ({"verification_score": 0.19}, SupervisorDecision.REQUEST_MORE_INFO),
        ({"duplicate_probability": 0.8}, SupervisorDecision.MERGE_WITH_EXISTING_CASE),
        ({"autonomy": AutonomyLevel.L3_ESCALATE}, SupervisorDecision.ESCALATE),
        ({"priority": Priority.CRITICAL}, SupervisorDecision.ESCALATE),
        ({"safety_term": "kivilcim"}, SupervisorDecision.ESCALATE),
        ({"case_type_code": "OUT_OF_SCOPE"}, SupervisorDecision.REJECT_OUT_OF_SCOPE),
        ({"classification_confidence": 0.69}, SupervisorDecision.SEND_TO_HUMAN_REVIEW),
        ({"classification_confidence": None}, SupervisorDecision.SEND_TO_HUMAN_REVIEW),
        ({"duplicate_probability": 0.6}, SupervisorDecision.SEND_TO_HUMAN_REVIEW),
        ({"routing_decision": "NO_DEPARTMENT"}, SupervisorDecision.SEND_TO_HUMAN_REVIEW),
        ({"routing_decision": "ROUTE_TO_POOL"}, SupervisorDecision.CREATE_TASK),
    ],
)
def test_each_rule(changes: dict[str, object], decision: SupervisorDecision) -> None:
    assert _decide(**changes).output.decision is decision


def test_boundaries_belong_to_the_safer_side() -> None:
    # 0.20 dogrulama yeterli; 0.70 guven otomatik atamaya yeter; 0.59 benzerlik yok sayilir
    assert _decide(verification_score=0.2).decision == "AUTO_ASSIGN"
    assert _decide(classification_confidence=0.7).decision == "AUTO_ASSIGN"
    assert _decide(duplicate_probability=0.59).decision == "AUTO_ASSIGN"


def test_first_matching_rule_wins() -> None:
    # Anlamsiz metin guvenlik kelimesi icerse bile once ek bilgi istenir
    assert _decide(is_meaningful=False, safety_term="duman").decision == "REQUEST_MORE_INFO"
    # Guvenlik, kapsam disi olmaktan once gelir
    assert _decide(case_type_code="OUT_OF_SCOPE", safety_term="yangin").decision == "ESCALATE"


@pytest.mark.parametrize(
    ("changes", "review"),
    [
        ({"priority": Priority.CRITICAL}, True),
        ({"classification_confidence": 0.1}, True),
        ({"is_meaningful": False}, False),
        ({"routing_decision": "ROUTE_TO_POOL"}, False),
    ],
)
def test_manager_review_flag(changes: dict[str, object], review: bool) -> None:
    assert _decide(**changes).output.needs_human_review is review


@pytest.mark.parametrize("routing", ["ASSIGN_STAFF", "ROUTE_TO_POOL"])
def test_l2_types_are_handled_automatically_but_the_manager_is_told(routing: str) -> None:
    result = _decide(autonomy=AutonomyLevel.L2_NOTIFY, routing_decision=routing)

    assert result.output.notify_manager is True
    assert result.output.needs_human_review is False


def test_reason_names_the_rule_and_the_values_used() -> None:
    result = _decide(priority=Priority.CRITICAL)

    reason = result.reasons[0]
    assert reason.code == "RULE_3_ESCALATE"
    assert reason.evidence["priority"] == "CRITICAL"
    assert reason.evidence["autonomy"] == "L1_AUTONOMOUS"
