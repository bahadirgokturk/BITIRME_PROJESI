"""Gorev tamamlaninca dogrulama (E5-11, docs/AGENTS.md 4.9).

FAZ 4'teki gecici otomatik kapatmanin yerini alir.

Bildirim RESOLVED -> VERIFICATION olur; sonra Resolution Agent'in kararina gore:
- RESOLVED: CLOSED
- NEEDS_MORE_EVIDENCE: gorev personele geri doner (IN_PROGRESS); ikinci kez yetersizse manager
  karar verir
- REOPEN (is yapilamamis): REOPENED -> ESCALATED, manager yeniden atar
Agent hatti kapaliysa (AGENTS_ENABLED=false) bildirim VERIFICATION'da manager'i bekler.
"""

import uuid
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.agents.base import AgentContext, AgentResult
from app.agents.resolution import (
    ResolutionAgent,
    ResolutionDecision,
    ResolutionInput,
    ResolutionOutput,
)
from app.core.clock import Clock
from app.models import Case, CaseType, Task
from app.models.enums import ActorType, CaseEventType, CaseStatus, TaskStatus
from app.repositories import agent_decision_repository, attachment_repository
from app.repositories.agent_decision_repository import DecisionRun
from app.services.workflow import Transition, WorkflowService, ensure_task_transition_allowed

AGENT = "resolution"
SECONDS_PER_MINUTE = 60
# Personelden bir kez kanit istenir; ikinci kez yetersizse manager karar verir (sonsuz dongu yok)
MAX_EVIDENCE_REQUESTS = 1
# Agent kapaliyken olay kaydina yazilan kural
MANUAL_VERIFICATION_RULE = "manual_verification"


class ResolutionService:
    def __init__(self, session: Session, workflow: WorkflowService, clock: Clock) -> None:
        self._session = session
        self._workflow = workflow
        self._clock = clock

    def hold_for_manager(self, case: Case) -> None:
        """Agent hatti kapali: dogrulamayi manager yapar."""
        waiting = Transition(
            event_type=CaseEventType.RESOLUTION_EVALUATED,
            actor_type=ActorType.SYSTEM,
            metadata={"rule": MANUAL_VERIFICATION_RULE},
        )
        self._workflow.transition(case, CaseStatus.VERIFICATION, waiting)
        case.needs_human_review = True

    def evaluate(self, case: Case, task: Task) -> None:
        asked = agent_decision_repository.count(
            self._session, case.id, AGENT, ResolutionDecision.NEEDS_MORE_EVIDENCE.value
        )
        result = self._run(case, task)
        output = result.output
        evaluated = _agent(
            CaseEventType.RESOLUTION_EVALUATED,
            {"decision": output.decision.value, "message": output.message},
        )
        self._workflow.transition(case, CaseStatus.VERIFICATION, evaluated)
        if output.decision is ResolutionDecision.NEEDS_MORE_EVIDENCE and (
            asked >= MAX_EVIDENCE_REQUESTS
        ):
            # Ikinci kez yetersiz: manager inceleme kuyruguna
            case.needs_human_review = True
            return
        _APPLY[output.decision](self, case, task, output)

    def _run(self, case: Case, task: Task) -> AgentResult[ResolutionOutput]:
        now = self._clock.now()
        started = task.started_at or task.created_at
        inp = ResolutionInput(
            completion_note=task.completion_note,
            has_evidence_photo=task.assigned_user_id is not None
            and attachment_repository.count_evidence(self._session, case.id, task.assigned_user_id)
            > 0,
            work_minutes=max((now - started).total_seconds(), 0) / SECONDS_PER_MINUTE,
            case_type_code=self._case_type_code(case),
        )
        result = ResolutionAgent().run(inp, AgentContext(now=now))
        run = DecisionRun(case_id=case.id, run_id=uuid.uuid4(), at=now)
        agent_decision_repository.record(self._session, run, inp, result)  # type: ignore[arg-type]
        return result

    def _case_type_code(self, case: Case) -> str | None:
        # Gorevden gelen bildirimde tur iliskisi yuklenmemis olabilir
        if case.case_type_id is None:
            return None
        case_type = self._session.get(CaseType, case.case_type_id)
        return case_type.code if case_type else None

    def _close(self, case: Case, task: Task, output: ResolutionOutput) -> None:
        self._workflow.transition(case, CaseStatus.CLOSED, _agent(CaseEventType.CASE_CLOSED, {}))

    def _ask_for_evidence(self, case: Case, task: Task, output: ResolutionOutput) -> None:
        ensure_task_transition_allowed(task.status, TaskStatus.IN_PROGRESS)
        task.status = TaskStatus.IN_PROGRESS
        task.completed_at = None
        requested = _agent(
            CaseEventType.EVIDENCE_REQUESTED, {"task_id": task.id, "message": output.message}
        )
        self._workflow.transition(case, CaseStatus.IN_PROGRESS, requested)

    def _reopen(self, case: Case, task: Task, output: ResolutionOutput) -> None:
        reason: dict[str, object] = {"reason": output.message}
        self._workflow.transition(
            case, CaseStatus.REOPENED, _agent(CaseEventType.CASE_REOPENED, reason)
        )
        self._workflow.transition(
            case, CaseStatus.ESCALATED, _agent(CaseEventType.ESCALATED, reason)
        )
        case.assigned_staff_id = None


_APPLY: dict[
    ResolutionDecision, Callable[[ResolutionService, Case, Task, ResolutionOutput], None]
] = {
    ResolutionDecision.RESOLVED: ResolutionService._close,
    ResolutionDecision.NEEDS_MORE_EVIDENCE: ResolutionService._ask_for_evidence,
    ResolutionDecision.REOPEN: ResolutionService._reopen,
}


def _agent(event: CaseEventType, metadata: dict[str, object]) -> Transition:
    return Transition(
        event_type=event, actor_type=ActorType.AGENT, agent_name=AGENT, metadata=metadata
    )
