"""Surec madenciligi (docs/ANALYTICS.md "Surec haritasi", RQ4): olay kaydindan bildirimlerin
gercekte izledigi yollar.

Her bildirimin is olaylari zaman sirasiyla bir iz (trace) olusturur. Bunlardan iki sey cikar:
- Dogrudan-takip grafi: A olayindan hemen sonra B geldiyse A -> B oku; kac bildirimde ve ortanca
  bekleme (A'nin goruldugu andan B'ye).
- Varyantlar: ayni sirayla ilerleyen bildirim gruplari (en sik yollar).
Agent'larin her bildirimde ayni sirayla yazdigi ic olaylar, yorumlar ve SLA uyarilari haritaya
girmez: yonetici surecin is adimlarini gorur. Arka arkaya ayni olay bir kez sayilir.
"""

import statistics
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from itertools import pairwise

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.case_kpis import SECONDS_PER_MINUTE, rounded
from app.analytics.scope import NOT_COUNTED, Scope, Window
from app.core.constants import PERCENT, PROCESS_VARIANT_LIMIT
from app.models import Case, CaseEvent
from app.models.enums import CaseEventType

E = CaseEventType

# Haritadaki is adimlari, surecteki dogal sirayla (docs/WORKFLOW.md bolum 3)
MAP_ACTIVITIES = (
    E.CASE_CREATED,
    E.INFO_REQUESTED,
    E.INFO_PROVIDED,
    E.HUMAN_REVIEW_REQUESTED,
    E.ESCALATED,
    E.TASK_CREATED,
    E.TASK_DECLINED,
    E.TASK_REASSIGNED,
    E.TASK_ACCEPTED,
    E.WORK_STARTED,
    E.EVIDENCE_REQUESTED,
    E.WORK_COMPLETED,
    E.CASE_CLOSED,
    E.CASE_REOPENED,
    E.CASE_REJECTED,
)


@dataclass(frozen=True)
class Step:
    event: CaseEventType
    at: datetime


@dataclass(frozen=True)
class Activity:
    event: CaseEventType
    # Bu adima en az bir kez ugrayan bildirim sayisi
    cases: int


@dataclass(frozen=True)
class Edge:
    source: CaseEventType
    target: CaseEventType
    count: int
    median_min: float | None


@dataclass(frozen=True)
class Variant:
    steps: list[CaseEventType]
    count: int
    share_pct: float | None
    # Ilk adimdan son adima ortanca sure
    median_total_min: float | None


@dataclass(frozen=True)
class ProcessMap:
    case_count: int
    activities: list[Activity]
    edges: list[Edge]
    variants: list[Variant]


def _minutes(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds() / SECONDS_PER_MINUTE


def _collapse(trace: Sequence[Step]) -> list[Step]:
    """Arka arkaya ayni olaydan ilki kalir (bekleme adimin ilk goruldugu andan sayilir)."""
    kept: list[Step] = []
    for step in trace:
        if not kept or kept[-1].event != step.event:
            kept.append(step)
    return kept


def _median(values: list[float]) -> float | None:
    return rounded(statistics.median(values)) if values else None


def discover(
    traces: Sequence[Sequence[Step]], variant_limit: int = PROCESS_VARIANT_LIMIT
) -> ProcessMap:
    paths = [_collapse(trace) for trace in traces if trace]
    waits: dict[tuple[CaseEventType, CaseEventType], list[float]] = defaultdict(list)
    reached: Counter[CaseEventType] = Counter()
    by_path: dict[tuple[CaseEventType, ...], list[float]] = defaultdict(list)
    for path in paths:
        for a, b in pairwise(path):
            waits[(a.event, b.event)].append(_minutes(a.at, b.at))
        reached.update({step.event for step in path})
        by_path[tuple(step.event for step in path)].append(_minutes(path[0].at, path[-1].at))
    edges = [
        Edge(source, target, len(minutes), _median(minutes))
        for (source, target), minutes in waits.items()
    ]
    edges.sort(key=lambda e: (-e.count, e.source, e.target))
    return ProcessMap(
        case_count=len(paths),
        activities=[Activity(event, reached[event]) for event in MAP_ACTIVITIES if reached[event]],
        edges=edges,
        variants=_variants(by_path, len(paths), variant_limit),
    )


def _variants(
    by_path: dict[tuple[CaseEventType, ...], list[float]], total: int, limit: int
) -> list[Variant]:
    ranked = sorted(by_path.items(), key=lambda item: (-len(item[1]), item[0]))
    return [
        Variant(
            steps=list(steps),
            count=len(durations),
            share_pct=rounded(len(durations) * PERCENT / total),
            median_total_min=_median(durations),
        )
        for steps, durations in ranked[:limit]
    ]


def process_map(session: Session, scope: Scope, window: Window) -> ProcessMap:
    """Donemde acilan bildirimler (birlestirilenler sayilmaz)."""
    statement = scope.apply(
        select(CaseEvent.case_id, CaseEvent.event_type, CaseEvent.occurred_at)
        .join(Case, Case.id == CaseEvent.case_id)
        .where(
            window.contains(Case.created_at),
            Case.status.not_in(NOT_COUNTED),
            CaseEvent.event_type.in_(MAP_ACTIVITIES),
        )
        .order_by(CaseEvent.case_id, CaseEvent.occurred_at, CaseEvent.id)
    )
    traces: dict[int, list[Step]] = defaultdict(list)
    for case_id, event_type, occurred_at in session.execute(statement):
        traces[case_id].append(Step(CaseEventType(event_type), occurred_at))
    return discover(list(traces.values()))
