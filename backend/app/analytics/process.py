"""Surec analitigi (docs/ANALYTICS.md "Surec analitigi", RQ4): olay kaydindan adim sureleri.

Donemde acilan bildirimlerin olaylari okunur. Bir adimin suresi: baslangic olayinin ilk
gorulmesinden, ondan sonraki ilk bitis olayina kadar. Yeniden atama gibi tekrarlar ilk
sureci bozmaz.
"""

import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.case_kpis import SECONDS_PER_MINUTE, rounded
from app.analytics.scope import NOT_COUNTED, Scope, Window
from app.models import Case, CaseEvent
from app.models.enums import CaseEventType

E = CaseEventType


@dataclass(frozen=True)
class StepDefinition:
    start: CaseEventType
    end: CaseEventType
    # Yonetici ekraninda gorunen ad
    label: str


# Bildirimden kapanisa ana hat (docs/WORKFLOW.md bolum 1, olay tipleri bolum 3)
STEPS = (
    StepDefinition(E.CASE_CREATED, E.TASK_CREATED, "Bildirimden göreve"),
    StepDefinition(E.TASK_CREATED, E.TASK_ACCEPTED, "Görevden kabule"),
    StepDefinition(E.TASK_ACCEPTED, E.WORK_STARTED, "Kabulden işe başlamaya"),
    StepDefinition(E.WORK_STARTED, E.WORK_COMPLETED, "İşin yapılması"),
    StepDefinition(E.WORK_COMPLETED, E.CASE_CLOSED, "Tamamlanmadan kapanışa"),
)
_TRACKED = sorted({event for step in STEPS for event in (step.start, step.end)})


@dataclass(frozen=True)
class StepStats:
    step: StepDefinition
    count: int
    avg_min: float | None
    median_min: float | None


def _timelines(
    session: Session, scope: Scope, window: Window
) -> dict[int, dict[str, list[datetime]]]:
    """bildirim id -> olay tipi -> zamanlar (artan)."""
    statement = scope.apply(
        select(CaseEvent.case_id, CaseEvent.event_type, CaseEvent.occurred_at)
        .join(Case, Case.id == CaseEvent.case_id)
        .where(
            window.contains(Case.created_at),
            Case.status.not_in(NOT_COUNTED),
            CaseEvent.event_type.in_(_TRACKED),
        )
        .order_by(CaseEvent.occurred_at, CaseEvent.id)
    )
    timelines: dict[int, dict[str, list[datetime]]] = defaultdict(lambda: defaultdict(list))
    for case_id, event_type, occurred_at in session.execute(statement):
        timelines[case_id][event_type].append(occurred_at)
    return timelines


def _duration(timeline: dict[str, list[datetime]], step: StepDefinition) -> float | None:
    starts = timeline.get(step.start)
    if not starts:
        return None
    end = next((at for at in timeline.get(step.end, []) if at >= starts[0]), None)
    if end is None:
        return None
    return (end - starts[0]).total_seconds() / SECONDS_PER_MINUTE


def step_stats(session: Session, scope: Scope, window: Window) -> list[StepStats]:
    timelines = _timelines(session, scope, window).values()
    result = []
    for step in STEPS:
        minutes = [m for m in (_duration(t, step) for t in timelines) if m is not None]
        average = statistics.fmean(minutes) if minutes else None
        median = statistics.median(minutes) if minutes else None
        result.append(StepStats(step, len(minutes), rounded(average), rounded(median)))
    return result


def bottleneck(steps: list[StepStats]) -> StepStats | None:
    """En uzun medyanli adim; hic veri yoksa None."""
    measured = [step for step in steps if step.median_min is not None]
    return max(measured, key=lambda step: step.median_min or 0, default=None)
