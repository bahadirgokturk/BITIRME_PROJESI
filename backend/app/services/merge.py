"""Tekrar eden bildirimi ana bildirime baglama (E5-6). Agent hatti ve manager ayni kurali kullanir.

Bagli bildirim MERGED olur (gorev acilmaz); ana bildirimin duplicate_count'u bagli bildirimin
kendisi ve ona daha once baglananlar kadar artar ("ayni sorunu N kisi bildirdi").
"""

from app.core.clock import Clock
from app.core.errors import InvalidMergeTargetError
from app.models import Case
from app.models.enums import CaseEventType, CaseStatus
from app.services.workflow import MERGE_PARENT_STATUSES, Transition, WorkflowService


def ensure_can_merge_into(case: Case, parent: Case) -> None:
    if parent.id == case.id or parent.status not in MERGE_PARENT_STATUSES:
        raise InvalidMergeTargetError()


class CaseMerger:
    def __init__(self, workflow: WorkflowService, clock: Clock) -> None:
        self._workflow = workflow
        self._clock = clock

    def merge(self, case: Case, parent: Case, by: Transition) -> None:
        """`by` olayin aktorunu verir; metadata'ya ana bildirim bilgisi eklenir."""
        ensure_can_merge_into(case, parent)
        merged = _as_merge(
            by, {"parent_case_id": parent.id, "parent_case_number": parent.case_number}
        )
        self._workflow.transition(case, CaseStatus.MERGED, merged)
        case.parent_case_id = parent.id
        case.needs_human_review = False
        parent.duplicate_count += 1 + case.duplicate_count
        linked = _as_merge(by, {"merged_case_id": case.id, "merged_case_number": case.case_number})
        self._workflow.record(parent, linked, self._clock.now())


def _as_merge(by: Transition, link: dict[str, object]) -> Transition:
    return Transition(
        event_type=CaseEventType.CASE_MERGED,
        actor_type=by.actor_type,
        actor_id=by.actor_id,
        agent_name=by.agent_name,
        metadata={**by.metadata, **link},
    )
