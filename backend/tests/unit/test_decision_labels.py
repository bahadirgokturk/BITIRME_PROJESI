"""Agent karar kodlarinin Turkce adlari: yeni bir karar kodu eklenince adi da eklenmeli."""

from enum import StrEnum

import pytest

from app.agents.analytics_summary import AnalyticsSummaryAgent, SummarySource
from app.agents.classification import ClassificationAgent
from app.agents.duplicate import DuplicateAgent, DuplicateDecision
from app.agents.intake import IntakeAgent
from app.agents.monitoring import NO_ACTION, MonitoringAction, MonitoringAgent
from app.agents.priority import PriorityAgent
from app.agents.resolution import ResolutionAgent, ResolutionDecision
from app.agents.routing import RoutingAgent
from app.agents.supervisor import SupervisorAgent, SupervisorDecision
from app.agents.verification import VerificationAgent, VerificationLevel
from app.models.enums import Priority
from app.services.decision_labels import AGENT_LABELS, decision_label

AGENTS = [
    IntakeAgent,
    ClassificationAgent,
    DuplicateAgent,
    VerificationAgent,
    PriorityAgent,
    RoutingAgent,
    SupervisorAgent,
    ResolutionAgent,
    MonitoringAgent,
    AnalyticsSummaryAgent,
]
CODES: list[tuple[str, type[StrEnum] | list[str]]] = [
    ("intake", ["PARSED", "TOO_SHORT"]),
    ("duplicate", DuplicateDecision),
    ("verification", VerificationLevel),
    ("priority", Priority),
    ("routing", ["ASSIGN_STAFF", "ROUTE_TO_POOL", "NO_DEPARTMENT"]),
    ("supervisor", SupervisorDecision),
    ("resolution", ResolutionDecision),
    ("monitoring", [*MonitoringAction, NO_ACTION]),
    ("analytics_summary", SummarySource),
]


@pytest.mark.parametrize("agent", AGENTS, ids=lambda a: a.name)
def test_every_agent_has_a_name(agent: type) -> None:
    assert AGENT_LABELS[agent.name]


@pytest.mark.parametrize(("agent", "codes"), CODES, ids=[c[0] for c in CODES])
def test_every_decision_code_has_a_label(agent: str, codes: object) -> None:
    for code in codes:  # type: ignore[attr-defined]
        assert decision_label(agent, str(code), {}), (agent, code)


def test_classification_uses_the_case_type_name() -> None:
    names = {"SOAP_EMPTY": "Sabun bitti"}

    assert decision_label("classification", "SOAP_EMPTY", names) == "Sabun bitti"
    assert decision_label("classification", "UNKNOWN", names) is None


def test_the_same_code_means_different_things_per_agent() -> None:
    # Dusuk guven (dogrulama) ile dusuk oncelik ayni kod, farkli anlam
    assert decision_label("verification", "LOW", {}) != decision_label("priority", "LOW", {})
