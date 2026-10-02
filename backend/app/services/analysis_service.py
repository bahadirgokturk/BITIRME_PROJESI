"""Agent hatti / orchestrator (E5-8b, docs/AGENTS.md bolum 3).

Bildirim olusunca (ve bildirim yapan ek bilgi verince) yanittan sonra calisir:
Intake -> Classification -> Duplicate -> Verification -> Priority -> Routing -> Supervisor.
Her agent karari girdisiyle agent_decisions'a yazilir; Supervisor'in karari burada uygulanir
(durum gecisleri yalniz WorkflowService ile). Agent'lar DB'ye dokunmaz: gerekli sayilari bu
servis okur.
"""

import logging
import uuid
from collections.abc import Callable, Sequence
from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from fastapi import BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.base import Agent, AgentContext, AgentResult
from app.agents.classification import (
    CaseTypeInfo,
    ClassificationAgent,
    ClassificationInput,
    ClassificationOutput,
)
from app.agents.duplicate import (
    DuplicateAgent,
    DuplicateCandidate,
    DuplicateInput,
    DuplicateOutput,
)
from app.agents.intake import IntakeAgent, IntakeInput, IntakeOutput, LocationInfo
from app.agents.model_store import get_classifier
from app.agents.priority import PriorityAgent, PriorityInput, PriorityOutput
from app.agents.routing import RoutingAgent, RoutingInput, RoutingOutput, StaffCandidate
from app.agents.supervisor import (
    SupervisorAgent,
    SupervisorDecision,
    SupervisorInput,
    SupervisorOutput,
)
from app.agents.verification import VerificationAgent, VerificationInput, VerificationOutput
from app.core.clock import Clock
from app.core.constants import MIN_CONFIDENCE_AUTO_DEFAULT
from app.models import Case, CaseType
from app.models.enums import ActorType, AutonomyLevel, CaseEventType, CaseStatus
from app.repositories import agent_policy_repository, analysis_repository, case_repository
from app.repositories.agent_decision_repository import CONFIDENCE_DIGITS, DecisionRun, record
from app.services.merge import CaseMerger
from app.services.task_service import Assignment, TaskOpener
from app.services.workflow import Transition, WorkflowService

SessionScope = Callable[[], AbstractContextManager[Session]]

# Son 30 gun: ayni yerde benzer bildirim ve personelin ayni turdeki tecrubesi (AGENTS.md 4.5, 4.6)
LOOKBACK = timedelta(days=30)
# Tekrar adaylari: ayni sorunun bu sureden eski bildirimi ayri olay sayilir (AGENTS.md 4.3)
DUPLICATE_WINDOW = timedelta(hours=24)
# Bildirim yapana gosterilen soru (Supervisor kural 1)
AGENT_INFO_QUESTION = (
    "Sorunu ve yerini biraz daha ayrıntılı yazabilir misiniz? Örneğin hangi katta, hangi odada, "
    "ne gördünüz?"
)
# Ayni bildirim icin agent bir kez soru sorar; ikinci kez anlasilmazsa manager karar verir
MAX_AGENT_INFO_REQUESTS = 1

logger = logging.getLogger(__name__)


@dataclass
class _Outcome:
    case_type: CaseType
    classification: AgentResult[ClassificationOutput]
    duplicate: AgentResult[DuplicateOutput]
    verification: AgentResult[VerificationOutput]
    priority: AgentResult[PriorityOutput]
    routing: AgentResult[RoutingOutput]
    supervisor: AgentResult[SupervisorOutput]


class _Recorder:
    """Agent'i calistirir ve kararini ayni kosu kimligiyle kaydeder."""

    def __init__(self, session: Session, run: DecisionRun) -> None:
        self._session = session
        self._run = run
        self._ctx = AgentContext(now=run.at)

    def run[TIn: BaseModel, TOut: BaseModel](
        self, agent: Agent[TIn, TOut], inp: TIn
    ) -> AgentResult[TOut]:
        result = agent.run(inp, self._ctx)
        record(self._session, self._run, inp, result)  # type: ignore[arg-type]
        return result


class AnalysisService:
    def __init__(self, session: Session, clock: Clock) -> None:
        self._session = session
        self._clock = clock
        self._workflow = WorkflowService(session, clock)

    def analyze(self, case_id: int) -> None:
        case = case_repository.get(self._session, case_id)
        if case is None or case.status is not CaseStatus.ANALYZING:
            # Bu arada manager el koymus olabilir; agent karari ezmez
            logger.info("Bildirim %s analiz beklemiyor; agent hatti atlandi", case_id)
            return
        run = DecisionRun(case_id=case.id, run_id=uuid.uuid4(), at=self._clock.now())
        outcome = self._run_agents(case, _Recorder(self._session, run))
        self._apply(case, outcome)
        self._session.commit()

    # --- Agent'lar -----------------------------------------------------------------------

    def _run_agents(self, case: Case, recorder: _Recorder) -> _Outcome:
        # Ek bilgi yanitlari aciklamaya eklenir: ikinci analiz yeni bilgiyi gorur
        answers = analysis_repository.info_answers(self._session, case.id)
        description = " ".join([case.description, *answers])
        intake = recorder.run(IntakeAgent(), _intake_input(case, description))
        case_types = analysis_repository.active_case_types(self._session, case.organization_id)
        classification = recorder.run(
            ClassificationAgent(get_classifier()),
            _classification_input(case, description, case_types),
        )
        case_type = next(ct for ct in case_types if ct.code == classification.decision)
        duplicate = recorder.run(
            DuplicateAgent(), self._duplicate_input(case, description, case_type)
        )
        findings = _Findings(intake.output, classification, duplicate.output)
        verification = recorder.run(
            VerificationAgent(), self._verification_input(case, case_type, findings)
        )
        priority = recorder.run(PriorityAgent(), self._priority_input(case, case_type, findings))
        routing = recorder.run(RoutingAgent(), self._routing_input(case, case_type))
        signals = _Signals(findings, verification.output, priority.output)
        supervisor = recorder.run(
            SupervisorAgent(), self._supervisor_input(case_type, signals, routing.decision)
        )
        return _Outcome(
            case_type, classification, duplicate, verification, priority, routing, supervisor
        )

    def _duplicate_input(self, case: Case, description: str, case_type: CaseType) -> DuplicateInput:
        since = self._clock.now() - DUPLICATE_WINDOW
        candidates = analysis_repository.duplicate_candidates(self._session, case, since)
        return DuplicateInput(
            text=description,
            case_type_code=case_type.code,
            location_id=case.location_id,
            location_path=case.location.path,
            reported_at=case.created_at,
            candidates=[_candidate(c) for c in candidates],
        )

    def _verification_input(
        self, case: Case, case_type: CaseType, findings: "_Findings"
    ) -> VerificationInput:
        total, rejected = analysis_repository.reporter_history(self._session, case)
        intake = findings.intake
        return VerificationInput(
            has_photo=intake.has_photo,
            duplicate_count=findings.duplicate.duplicate_count,
            location_consistency=intake.location_consistency,
            reporter_case_count=total,
            reporter_rejected_count=rejected,
            verified_before_here=analysis_repository.verified_before_here(
                self._session, case, case_type.id
            ),
            is_meaningful=intake.is_meaningful,
        )

    def _priority_input(
        self, case: Case, case_type: CaseType, findings: "_Findings"
    ) -> PriorityInput:
        since = self._clock.now() - LOOKBACK
        intake = findings.intake
        return PriorityInput(
            base_severity=case_type.base_severity,
            base_priority=case_type.base_priority,
            is_safety_related=case_type.is_safety_related,
            safety_signal=findings.classification.output.safety_term is not None,
            urgency_hints=intake.urgency_hints,
            location_importance=case.location.importance_weight,
            duplicate_count=findings.duplicate.duplicate_count,
            recent_similar_count=analysis_repository.recent_similar_count(
                self._session, case, case_type.id, since
            ),
        )

    def _routing_input(self, case: Case, case_type: CaseType) -> RoutingInput:
        department_id = case_type.default_department_id
        staff = []
        if department_id is not None:
            since = self._clock.now() - LOOKBACK
            facts = analysis_repository.staff_facts(
                self._session, department_id, case_type.id, since
            )
            staff = [StaffCandidate(**vars(f)) for f in facts]
        return RoutingInput(
            case_type_code=case_type.code,
            department_id=department_id,
            secondary_department_id=case_type.secondary_department_id,
            building_code=analysis_repository.building_code(case.location.path),
            staff=staff,
        )

    def _supervisor_input(
        self, case_type: CaseType, signals: "_Signals", routing_decision: str
    ) -> SupervisorInput:
        policy = agent_policy_repository.get_for_case_type(
            self._session, case_type.organization_id, case_type.id
        )
        return SupervisorInput(
            is_meaningful=signals.findings.intake.is_meaningful,
            verification_score=signals.verification.score,
            duplicate_probability=signals.findings.duplicate.duplicate_probability,
            case_type_code=case_type.code,
            # Politika yoksa en temkinli varsayilan: uygula ama manager'a bildir
            autonomy=policy.autonomy_level if policy else AutonomyLevel.L2_NOTIFY,
            min_confidence_auto=float(
                policy.min_confidence_auto if policy else Decimal(MIN_CONFIDENCE_AUTO_DEFAULT)
            ),
            classification_confidence=signals.findings.classification.confidence,
            priority=signals.priority.priority,
            safety_term=signals.findings.classification.output.safety_term,
            routing_decision=routing_decision,
        )

    # --- Karar uygulama -------------------------------------------------------------------

    def _apply(self, case: Case, outcome: _Outcome) -> None:
        decision = outcome.supervisor.output.decision
        if decision is SupervisorDecision.REQUEST_MORE_INFO and self._already_asked(case):
            decision = SupervisorDecision.SEND_TO_HUMAN_REVIEW
        self._agent_event(case, CaseEventType.SUPERVISOR_DECIDED, "supervisor", decision.value)
        if decision is SupervisorDecision.REQUEST_MORE_INFO:
            self._request_info(case)
            return
        self._classify(case, outcome)
        _APPLY[decision](self, case, outcome)

    def _already_asked(self, case: Case) -> bool:
        asked = analysis_repository.agent_info_requests(self._session, case.id)
        return asked >= MAX_AGENT_INFO_REQUESTS

    def _request_info(self, case: Case) -> None:
        case.info_request = AGENT_INFO_QUESTION
        asked = _agent(
            CaseEventType.INFO_REQUESTED, "supervisor", {"question": AGENT_INFO_QUESTION}
        )
        self._workflow.transition(case, CaseStatus.NEEDS_INFO, asked)

    def _classify(self, case: Case, outcome: _Outcome) -> None:
        case.case_type_id = outcome.case_type.id
        case.category = outcome.case_type.category
        case.priority = outcome.priority.output.priority
        case.impact_score = outcome.priority.output.impact_score
        case.confidence_score = _score(outcome.classification.confidence)
        case.verification_score = _score(outcome.verification.output.score)
        case.department_id = outcome.routing.output.department_id
        case.needs_human_review = outcome.supervisor.output.needs_human_review

    def _escalate(self, case: Case, outcome: _Outcome) -> None:
        self._agent_event(
            case, CaseEventType.AI_CLASSIFIED, "classification", outcome.case_type.code
        )
        escalated = _agent(CaseEventType.ESCALATED, "supervisor", {"rule": _rule(outcome)})
        self._workflow.transition(case, CaseStatus.ESCALATED, escalated)

    def _reject(self, case: Case, outcome: _Outcome) -> None:
        self._agent_event(
            case, CaseEventType.AI_CLASSIFIED, "classification", outcome.case_type.code
        )
        rejected = _agent(CaseEventType.CASE_REJECTED, "supervisor", {"reason": "OUT_OF_SCOPE"})
        self._workflow.transition(case, CaseStatus.REJECTED, rejected)

    def _merge(self, case: Case, outcome: _Outcome) -> None:
        parent_id = outcome.duplicate.output.possible_parent_case_id
        parent = case_repository.get(self._session, parent_id) if parent_id else None
        if parent is None:
            raise ValueError(f"Bildirim {case.id}: birlestirilecek ana bildirim yok")
        score = outcome.duplicate.output.duplicate_probability
        by = _agent(CaseEventType.CASE_MERGED, "duplicate", {"score": score})
        CaseMerger(self._workflow, self._clock).merge(case, parent, by)

    def _human_review(self, case: Case, outcome: _Outcome) -> None:
        # Gerekce: dusuk guven, olasi tekrar, birimsiz tur ya da ikinci kez anlasilmayan metin
        case.needs_human_review = True
        self._mark_classified(case, outcome)

    def _open_task(self, case: Case, outcome: _Outcome) -> None:
        self._mark_classified(case, outcome)
        routing = outcome.routing.output
        if routing.department_id is None:
            raise ValueError(f"Bildirim {case.id}: gorev icin birim yok")
        assignment = Assignment(
            department_id=routing.department_id, user_id=routing.assigned_user_id
        )
        self._agent_event(case, CaseEventType.ROUTED, "routing", outcome.routing.decision)
        TaskOpener(self._session, self._workflow, self._clock).open(
            case, assignment, _agent(CaseEventType.TASK_CREATED, "routing", {})
        )

    def _mark_classified(self, case: Case, outcome: _Outcome) -> None:
        classified = _agent(
            CaseEventType.AI_CLASSIFIED,
            "classification",
            {"case_type": outcome.case_type.code, "confidence": outcome.classification.confidence},
        )
        self._workflow.transition(case, CaseStatus.CLASSIFIED, classified)

    def _agent_event(self, case: Case, event: CaseEventType, agent: str, decision: object) -> None:
        self._workflow.record(
            case, _agent(event, agent, {"decision": str(decision)}), self._clock.now()
        )


@dataclass(frozen=True)
class _Findings:
    """Verification ve Priority'den once bilinenler."""

    intake: IntakeOutput
    classification: AgentResult[ClassificationOutput]
    duplicate: DuplicateOutput


@dataclass(frozen=True)
class _Signals:
    findings: _Findings
    verification: VerificationOutput
    priority: PriorityOutput


_APPLY: dict[SupervisorDecision, Callable[[AnalysisService, Case, _Outcome], None]] = {
    SupervisorDecision.ESCALATE: AnalysisService._escalate,
    SupervisorDecision.REJECT_OUT_OF_SCOPE: AnalysisService._reject,
    SupervisorDecision.SEND_TO_HUMAN_REVIEW: AnalysisService._human_review,
    SupervisorDecision.MERGE_WITH_EXISTING_CASE: AnalysisService._merge,
    SupervisorDecision.AUTO_ASSIGN: AnalysisService._open_task,
    SupervisorDecision.CREATE_TASK: AnalysisService._open_task,
}


def _agent(event: CaseEventType, agent: str, metadata: dict[str, object]) -> Transition:
    return Transition(
        event_type=event, actor_type=ActorType.AGENT, agent_name=agent, metadata=metadata
    )


def _rule(outcome: _Outcome) -> int:
    return outcome.supervisor.output.rule


def _score(value: float | None) -> Decimal | None:
    return None if value is None else round(Decimal(value), CONFIDENCE_DIGITS)


def _candidate(case: Case) -> DuplicateCandidate:
    case_type = case.case_type
    if case_type is None:
        raise ValueError(f"Aday bildirim {case.id} siniflandirilmamis")
    return DuplicateCandidate(
        case_id=case.id,
        text=case.description,
        case_type_code=case_type.code,
        location_id=case.location_id,
        location_path=case.location.path,
        created_at=case.created_at,
        duplicate_count=case.duplicate_count,
    )


def _intake_input(case: Case, description: str) -> IntakeInput:
    return IntakeInput(
        title=case.title,
        description=description,
        location=LocationInfo(name=case.location.name, path=case.location.path),
        # Fotograf bildirimden sonra ayri istekle yuklenir; analiz aninda henuz yok
        has_photo=False,
    )


def _classification_input(
    case: Case, description: str, case_types: Sequence[CaseType]
) -> ClassificationInput:
    return ClassificationInput(
        title=case.title,
        description=description,
        case_types=[
            CaseTypeInfo(code=ct.code, category=ct.category, keywords=list(ct.keywords))
            for ct in case_types
        ],
    )


class AnalysisLauncher:
    """Agent hattini yanittan sonra (BackgroundTasks) kendi oturumuyla calistirir."""

    def __init__(self, sessions: SessionScope, clock: Clock) -> None:
        self._sessions = sessions
        self._clock = clock

    def schedule(self, background: BackgroundTasks, case_id: int) -> None:
        background.add_task(self.run, case_id)

    def run(self, case_id: int) -> None:
        with self._sessions() as session:
            AnalysisService(session, self._clock).analyze(case_id)
