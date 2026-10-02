"""Monitoring Agent (AGENTS.md 4.8): acik bildirimleri periyodik izler, ne yapilacagini soyler.

Ayni uyari bir kez uretilir: daha once uretildiyse servis bayragi gonderir, agent tekrar etmez.
"""

from datetime import UTC, datetime

import pytest

from app.agents.base import RULES_MODEL, AgentContext
from app.agents.monitoring import (
    ANALYZING_STUCK_MINUTES,
    NEEDS_INFO_TIMEOUT_MINUTES,
    CaseSnapshot,
    MonitoringAction,
    MonitoringAgent,
)
from app.models.enums import CaseStatus, SlaStatus

CTX = AgentContext(now=datetime(2026, 10, 7, 7, 0, tzinfo=UTC))
CALM = CaseSnapshot(
    case_id=1,
    status=CaseStatus.IN_PROGRESS,
    sla_status=SlaStatus.ON_TRACK,
    minutes_in_status=10,
    response_overdue=False,
    warned=False,
    breached=False,
    reassign_recommended=False,
)


def _actions(**changes: object) -> list[MonitoringAction]:
    result = MonitoringAgent().run(CALM.model_copy(update=changes), CTX)
    assert result.model == RULES_MODEL
    return [a.action for a in result.output.actions]


def test_a_case_on_track_needs_nothing() -> None:
    result = MonitoringAgent().run(CALM, CTX)

    assert result.output.actions == []
    assert result.decision == "NO_ACTION"


def test_at_risk_case_gets_one_warning() -> None:
    assert _actions(sla_status=SlaStatus.AT_RISK) == [MonitoringAction.SLA_WARNING]
    assert _actions(sla_status=SlaStatus.AT_RISK, warned=True) == []


def test_breached_case_is_escalated_once_without_a_late_warning() -> None:
    assert _actions(sla_status=SlaStatus.BREACHED) == [MonitoringAction.SLA_BREACHED]
    assert _actions(sla_status=SlaStatus.BREACHED, breached=True) == []


def test_unaccepted_task_after_the_response_target_gets_a_reassign_recommendation() -> None:
    overdue = {"status": CaseStatus.ASSIGNED, "response_overdue": True}

    assert _actions(**overdue) == [MonitoringAction.RECOMMEND_REASSIGN]
    assert _actions(**overdue, reassign_recommended=True) == []


def test_sla_and_reassign_signals_are_independent() -> None:
    actions = _actions(
        status=CaseStatus.ASSIGNED, response_overdue=True, sla_status=SlaStatus.AT_RISK
    )

    assert actions == [MonitoringAction.SLA_WARNING, MonitoringAction.RECOMMEND_REASSIGN]


@pytest.mark.parametrize(
    ("status", "limit", "action"),
    [
        (CaseStatus.ANALYZING, ANALYZING_STUCK_MINUTES, MonitoringAction.RERUN_ANALYSIS),
        (CaseStatus.NEEDS_INFO, NEEDS_INFO_TIMEOUT_MINUTES, MonitoringAction.CLOSE_UNANSWERED),
    ],
)
def test_cases_stuck_too_long_in_a_waiting_status(
    status: CaseStatus, limit: int, action: MonitoringAction
) -> None:
    waiting = {"status": status, "sla_status": None}

    assert _actions(**waiting, minutes_in_status=limit - 1) == []
    assert _actions(**waiting, minutes_in_status=limit) == [action]


def test_the_reason_explains_the_action() -> None:
    result = MonitoringAgent().run(CALM.model_copy(update={"sla_status": SlaStatus.BREACHED}), CTX)

    assert result.decision == "SLA_BREACHED"
    assert result.reasons[0].code == "SLA_BREACHED"
    assert "süre" in result.reasons[0].message
