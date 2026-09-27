"""Bildirim durum makinesi (docs/WORKFLOW.md bolum 1). Status BASKA HICBIR YERDE degistirilmez.

Her gecis: tablo kontrolu -> ilgili zaman damgasi -> case_events satiri, hepsi ayni transaction'da.
Commit'i cagiran servis yapar; hata olursa hicbiri kalici olmaz.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.clock import Clock
from app.core.errors import InvalidTransitionError
from app.models import Case, CaseEvent
from app.models.enums import ActorType, CaseEventType
from app.models.enums import CaseStatus as S
from app.repositories import case_repository

ALLOWED_TRANSITIONS: dict[S, frozenset[S]] = {
    S.NEW: frozenset({S.ANALYZING}),
    S.ANALYZING: frozenset({S.CLASSIFIED, S.NEEDS_INFO, S.MERGED, S.ESCALATED, S.REJECTED}),
    S.NEEDS_INFO: frozenset({S.ANALYZING, S.REJECTED}),
    S.CLASSIFIED: frozenset({S.ASSIGNED, S.ESCALATED, S.MERGED, S.REJECTED}),
    S.ESCALATED: frozenset({S.ASSIGNED, S.MERGED, S.REJECTED}),
    # ASSIGNED -> ASSIGNED: yeniden atama
    S.ASSIGNED: frozenset({S.ACCEPTED, S.ASSIGNED, S.ESCALATED}),
    S.ACCEPTED: frozenset({S.IN_PROGRESS, S.ASSIGNED, S.ESCALATED}),
    S.IN_PROGRESS: frozenset({S.RESOLVED, S.ESCALATED}),
    S.RESOLVED: frozenset({S.VERIFICATION}),
    S.VERIFICATION: frozenset({S.CLOSED, S.IN_PROGRESS, S.REOPENED}),
    S.CLOSED: frozenset({S.REOPENED}),
    S.REOPENED: frozenset({S.ASSIGNED, S.ESCALATED}),
    S.REJECTED: frozenset(),
    S.MERGED: frozenset(),
}

# Duruma ilk giriste yazilan zaman damgasi; ilk deger korunur, sonraki girisler olay kaydinda kalir
_FIRST_TIME_FIELDS: dict[S, str] = {
    S.CLASSIFIED: "classified_at",
    S.ASSIGNED: "assigned_at",
    S.ACCEPTED: "accepted_at",
    S.IN_PROGRESS: "started_at",
    S.VERIFICATION: "verified_at",
    S.CLOSED: "closed_at",
}
# Istisna: reopen sonrasi yeniden cozulunce cozum zamani guncellenir (SLA son cozume gore olculur)
_ALWAYS_UPDATED_FIELDS: dict[S, str] = {S.RESOLVED: "resolved_at"}


@dataclass(frozen=True)
class Transition:
    """Gecisi kim, hangi olay adiyla yapti. Olay kaydina aynen yazilir."""

    event_type: CaseEventType
    actor_type: ActorType
    actor_id: int | None = None
    agent_name: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def ensure_transition_allowed(source: S, target: S) -> None:
    if target not in ALLOWED_TRANSITIONS[source]:
        raise InvalidTransitionError(details={"from_status": source, "to_status": target})


class WorkflowService:
    def __init__(self, session: Session, clock: Clock) -> None:
        self._session = session
        self._clock = clock

    def transition(self, case: Case, target: S, transition: Transition) -> None:
        source = case.status
        ensure_transition_allowed(source, target)
        now = self._clock.now()
        case.status = target
        _stamp(case, target, now)
        if target is S.REOPENED:
            case.reopened_count += 1
        self.record(case, transition, now, source=source)

    def record(
        self, case: Case, transition: Transition, now: datetime, source: S | None = None
    ) -> None:
        """Olay kaydi yazar. Durum degismeyen olaylar (olusturma, yorum) da buradan gecer."""
        case_repository.add_event(
            self._session,
            CaseEvent(
                case_id=case.id,
                event_type=transition.event_type,
                actor_type=transition.actor_type,
                actor_id=transition.actor_id,
                agent_name=transition.agent_name,
                from_status=source,
                to_status=case.status,
                occurred_at=now,
                metadata_json=transition.metadata,
            ),
        )


def _stamp(case: Case, target: S, now: datetime) -> None:
    if target in _ALWAYS_UPDATED_FIELDS:
        setattr(case, _ALWAYS_UPDATED_FIELDS[target], now)
        return
    name = _FIRST_TIME_FIELDS.get(target)
    if name is not None and getattr(case, name) is None:
        setattr(case, name, now)
