"""Manager inceleme kuyrugu, duzeltme ve reddetme (E5-9, docs/UI_GUIDE.md 5.4).

Kuyruk: agent'in yukselttigi ya da emin olamadigi bildirimler. Manager AI onerisini onaylar (atama,
TaskService), duzeltir (override) ya da reddeder. Duzeltme ilgili agent kararina bagli olarak
decision_feedback'e yazilir; yeniden egitim verisi ve override rate metrigi buradan gelir.
Birlestirme (merge) de bir duzeltmedir: Duplicate Agent'in onerisi ve manager'in karari yazilir.
"""

from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.clock import Clock
from app.core.errors import InvalidOverrideValueError, NotFoundError
from app.models import Case, DecisionFeedback, User
from app.models.enums import ActorType, CaseEventType, CaseStatus, OverrideField, Priority
from app.repositories import (
    case_repository,
    case_type_repository,
    department_repository,
    review_repository,
)
from app.schemas.case import (
    CaseRead,
    CaseRef,
    CloseRequest,
    MergeRequest,
    OverrideRequest,
    RejectRequest,
    ReviewItemRead,
)
from app.schemas.common import Page, PageParams
from app.services.authorization import ensure_can_view_case
from app.services.case_view import case_read
from app.services.merge import CaseMerger
from app.services.workflow import Transition, WorkflowService

# Her alan hangi agent'in kararini duzeltir
_AGENT_OF: dict[OverrideField, str] = {
    OverrideField.CASE_TYPE: "classification",
    OverrideField.PRIORITY: "priority",
    OverrideField.DEPARTMENT: "routing",
}
# Birlestirme duzeltmesinin alan adi ve kaynagi (OverrideField degil: durum degisir)
DUPLICATE_FIELD = "duplicate"
DUPLICATE_AGENT = "duplicate"
# Dogrulama duzeltmesi: Resolution Agent'in karari -> manager kapatti
RESOLUTION_FIELD = "resolution"
CLOSED_VALUE = "RESOLVED"


@dataclass(frozen=True)
class _Change:
    original: str | None
    corrected: str


class ReviewService:
    def __init__(self, session: Session, actor: User, clock: Clock) -> None:
        self._session = session
        self._actor = actor
        self._clock = clock
        self._workflow = WorkflowService(session, clock)

    def queue(self, paging: PageParams) -> Page[ReviewItemRead]:
        cases, total = review_repository.queue_page(
            self._session, self._actor.organization_id, paging
        )
        return Page(items=[self._item(case) for case in cases], total=total, page=paging.page)

    def override(self, case_id: int, data: OverrideRequest) -> CaseRead:
        case = self._visible_case(case_id)
        change = _SETTERS[data.field](self, case, data.corrected_value)
        decision = review_repository.latest_decision(self._session, case.id, _AGENT_OF[data.field])
        feedback = DecisionFeedback(
            decision_id=decision.id if decision else None,
            case_id=case.id,
            user_id=self._actor.id,
            field=data.field.value,
            original_value=change.original,
            corrected_value=change.corrected,
            reason=data.reason,
            created_at=self._clock.now(),
        )
        self._session.add(feedback)
        self._session.flush()
        metadata: dict[str, object] = {
            "field": data.field.value,
            "from": change.original,
            "to": change.corrected,
            "feedback_id": feedback.id,
        }
        overridden = self._by_user(CaseEventType.DECISION_OVERRIDDEN, metadata)
        self._workflow.record(case, overridden, self._clock.now())
        return self._commit_and_read(case)

    def merge(self, case_id: int, data: MergeRequest) -> CaseRead:
        case = self._visible_case(case_id)
        parent = self._visible_case(data.parent_case_id)
        decision = review_repository.latest_decision(self._session, case.id, DUPLICATE_AGENT)
        suggested = self._suggested_parent(decision.output_json if decision else None)
        merged = self._by_user(CaseEventType.CASE_MERGED, {"reason": data.reason})
        CaseMerger(self._workflow, self._clock).merge(case, parent, merged)
        self._session.add(
            DecisionFeedback(
                decision_id=decision.id if decision else None,
                case_id=case.id,
                user_id=self._actor.id,
                field=DUPLICATE_FIELD,
                original_value=suggested.case_number if suggested else None,
                corrected_value=parent.case_number,
                reason=data.reason,
                created_at=self._clock.now(),
            )
        )
        return self._commit_and_read(case)

    def close(self, case_id: int, data: CloseRequest) -> CaseRead:
        case = self._visible_case(case_id)
        closed = self._by_user(CaseEventType.CASE_CLOSED, {"reason": data.reason})
        self._workflow.transition(case, CaseStatus.CLOSED, closed)
        case.needs_human_review = False
        decision = review_repository.latest_decision(
            self._session, case.id, review_repository.RESOLUTION
        )
        if decision is not None:
            self._session.add(
                DecisionFeedback(
                    decision_id=decision.id,
                    case_id=case.id,
                    user_id=self._actor.id,
                    field=RESOLUTION_FIELD,
                    original_value=decision.decision,
                    corrected_value=CLOSED_VALUE,
                    reason=data.reason,
                    created_at=self._clock.now(),
                )
            )
        return self._commit_and_read(case)

    def reject(self, case_id: int, data: RejectRequest) -> CaseRead:
        case = self._visible_case(case_id)
        rejected = self._by_user(CaseEventType.CASE_REJECTED, {"reason": data.reason})
        self._workflow.transition(case, CaseStatus.REJECTED, rejected)
        case.needs_human_review = False
        return self._commit_and_read(case)

    # --- Alan duzelticiler --------------------------------------------------------------

    def _set_case_type(self, case: Case, code: str) -> _Change:
        case_type = case_type_repository.get_by_code(self._session, case.organization_id, code)
        if case_type is None or not case_type.is_active:
            raise InvalidOverrideValueError(OverrideField.CASE_TYPE.value, code)
        original = case.case_type.code if case.case_type else None
        case.case_type_id = case_type.id
        case.category = case_type.category
        return _Change(original=original, corrected=case_type.code)

    def _set_priority(self, case: Case, value: str) -> _Change:
        if value not in Priority.__members__:
            raise InvalidOverrideValueError(OverrideField.PRIORITY.value, value)
        original = case.priority.value if case.priority else None
        case.priority = Priority(value)
        return _Change(original=original, corrected=value)

    def _set_department(self, case: Case, code: str) -> _Change:
        department = department_repository.get_by_code(self._session, case.organization_id, code)
        if department is None or not department.is_active:
            raise InvalidOverrideValueError(OverrideField.DEPARTMENT.value, code)
        original = case.department.code if case.department else None
        case.department_id = department.id
        return _Change(original=original, corrected=department.code)

    # --- Yardimcilar --------------------------------------------------------------------

    def _item(self, case: Case) -> ReviewItemRead:
        decision = review_repository.latest_explanation(self._session, case.id)
        reason = decision.reason_json[0] if decision and decision.reason_json else None
        confidence = case.confidence_score
        duplicate = review_repository.latest_decision(self._session, case.id, DUPLICATE_AGENT)
        suggested = self._suggested_parent(duplicate.output_json if duplicate else None)
        return ReviewItemRead(
            case=case_read(case, self._clock.now()),
            reason_code=reason["code"] if reason else None,
            reason=reason["message"] if reason else None,
            confidence=float(confidence) if confidence is not None else None,
            possible_duplicate_of=CaseRef.model_validate(suggested, from_attributes=True)
            if suggested
            else None,
        )

    def _suggested_parent(self, output: dict[str, object] | None) -> Case | None:
        """Duplicate Agent'in isaret ettigi ana bildirim (esik ustu en benzer); yoksa None."""
        parent_id = output.get("possible_parent_case_id") if output else None
        if not isinstance(parent_id, int):
            return None
        return case_repository.get(self._session, parent_id)

    def _by_user(self, event: CaseEventType, metadata: dict[str, object]) -> Transition:
        return Transition(
            event_type=event, actor_type=ActorType.USER, actor_id=self._actor.id, metadata=metadata
        )

    def _visible_case(self, case_id: int) -> Case:
        case = case_repository.get(self._session, case_id)
        if case is None:
            raise NotFoundError()
        ensure_can_view_case(self._actor, case)
        return case

    def _commit_and_read(self, case: Case) -> CaseRead:
        self._session.commit()
        refreshed = case_repository.get(self._session, case.id)
        if refreshed is None:
            raise NotFoundError()
        return case_read(refreshed, self._clock.now())


_SETTERS: dict[OverrideField, Callable[[ReviewService, Case, str], _Change]] = {
    OverrideField.CASE_TYPE: ReviewService._set_case_type,
    OverrideField.PRIORITY: ReviewService._set_priority,
    OverrideField.DEPARTMENT: ReviewService._set_department,
}
