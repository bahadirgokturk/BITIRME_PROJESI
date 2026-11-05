"""SLA hesabi (E4-2). Saf fonksiyonlar: veritabani ve saat disaridan verilir (test edilebilir).

- Kural eslesmesi (DATABASE.md "sla_rules"): once (tip, oncelik), yoksa (varsayilan, oncelik).
- Durum okuma aninda hesaplanir; ucretsiz hosting'te uygulama uyusa da dogru kalir (ARCHITECTURE 6).
  Cozulmus bildirimde karar cozum anina gore verilir ve bir daha degismez.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.constants import PERCENT, SLA_FALLBACK_PRIORITY, SLA_WARNING_PCT_DEFAULT
from app.models import Case, SlaRule
from app.models.enums import SLA_SETTLED_STATUSES, Priority, SlaStatus


@dataclass(frozen=True)
class RuleKey:
    case_type_id: int | None
    priority: Priority


@dataclass(frozen=True)
class SlaTargets:
    response_minutes: int
    resolution_minutes: int
    warning_pct: int
    rule_id: int | None = None


@dataclass(frozen=True)
class SlaClock:
    started_at: datetime
    due_at: datetime | None
    warning_pct: int
    resolved_at: datetime | None
    now: datetime


def match_rule(
    rules: dict[RuleKey, SlaTargets], *, case_type_id: int | None, priority: Priority
) -> SlaTargets | None:
    exact = rules.get(RuleKey(case_type_id=case_type_id, priority=priority))
    if exact is not None:
        return exact
    return rules.get(RuleKey(case_type_id=None, priority=priority))


def sla_status(clock: SlaClock) -> SlaStatus | None:
    if clock.due_at is None:
        return None
    if clock.resolved_at is not None:
        # Cozulmus is: sonuc kesindir (zamaninda ya da gec)
        late = clock.resolved_at > clock.due_at
        return SlaStatus.BREACHED if late else SlaStatus.ON_TRACK
    if clock.now > clock.due_at:
        return SlaStatus.BREACHED
    window = clock.due_at - clock.started_at
    warning_at = clock.started_at + window * clock.warning_pct / PERCENT
    return SlaStatus.AT_RISK if clock.now >= warning_at else SlaStatus.ON_TRACK


def index_rules(rules: Iterable[SlaRule]) -> dict[RuleKey, SlaTargets]:
    return {
        RuleKey(case_type_id=rule.case_type_id, priority=rule.priority): SlaTargets(
            response_minutes=rule.response_minutes,
            resolution_minutes=rule.resolution_minutes,
            warning_pct=rule.warning_threshold_pct,
            rule_id=rule.id,
        )
        for rule in rules
    }


def effective_priority(case: Case) -> Priority:
    """Oncelik yoksa (Priority Agent FAZ 5) bildirim tipinin baslangic onceligi, o da yoksa orta."""
    if case.priority is not None:
        return case.priority
    if case.case_type is not None:
        return case.case_type.base_priority
    return Priority(SLA_FALLBACK_PRIORITY)


def apply_targets(case: Case, rules: dict[RuleKey, SlaTargets]) -> None:
    """Ilk atamada hedefleri yazar. Hedef zaten varsa dokunmaz: yeniden atama saati sifirlamaz."""
    if case.due_at is not None:
        return
    targets = match_rule(rules, case_type_id=case.case_type_id, priority=effective_priority(case))
    if targets is None:
        return
    case.sla_rule_id = targets.rule_id
    case.response_due_at = case.created_at + timedelta(minutes=targets.response_minutes)
    case.due_at = case.created_at + timedelta(minutes=targets.resolution_minutes)


def case_sla_status(case: Case, now: datetime) -> SlaStatus | None:
    warning_pct = case.sla_rule.warning_threshold_pct if case.sla_rule else SLA_WARNING_PCT_DEFAULT
    return sla_status(
        SlaClock(
            started_at=case.created_at,
            due_at=case.due_at,
            warning_pct=warning_pct,
            resolved_at=case.resolved_at if case.status in SLA_SETTLED_STATUSES else None,
            now=now,
        )
    )
