"""SLA hesabi (E4-2): kural eslesmesi ve okuma aninda durum (docs/ARCHITECTURE.md bolum 6)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.enums import Priority, SlaStatus
from app.services.sla import RuleKey, SlaClock, SlaTargets, match_rule, sla_status

START = datetime(2026, 9, 29, 8, 0, tzinfo=UTC)
WINDOW = timedelta(hours=8)
WARNING_PCT = 75


def _clock(now: datetime, resolved_at: datetime | None = None) -> SlaClock:
    return SlaClock(
        started_at=START,
        due_at=START + WINDOW,
        warning_pct=WARNING_PCT,
        resolved_at=resolved_at,
        now=now,
    )


@pytest.mark.parametrize(
    ("elapsed", "expected"),
    [
        (timedelta(hours=1), SlaStatus.ON_TRACK),
        # %75 = 6 saat: esik aninda "riskte"
        (timedelta(hours=6), SlaStatus.AT_RISK),
        (timedelta(hours=7, minutes=59), SlaStatus.AT_RISK),
        (timedelta(hours=8, seconds=1), SlaStatus.BREACHED),
    ],
)
def test_open_case_status_follows_the_clock(elapsed: timedelta, expected: SlaStatus) -> None:
    assert sla_status(_clock(START + elapsed)) is expected


def test_resolved_in_time_stays_on_track_forever() -> None:
    clock = _clock(now=START + timedelta(days=30), resolved_at=START + timedelta(hours=7))

    assert sla_status(clock) is SlaStatus.ON_TRACK


def test_resolved_late_stays_breached() -> None:
    clock = _clock(now=START + timedelta(days=30), resolved_at=START + timedelta(hours=9))

    assert sla_status(clock) is SlaStatus.BREACHED


def test_no_target_means_no_status() -> None:
    clock = SlaClock(started_at=START, due_at=None, warning_pct=75, resolved_at=None, now=START)

    assert sla_status(clock) is None


RULES = {
    RuleKey(case_type_id=None, priority=Priority.MEDIUM): SlaTargets(120, 480, 75),
    RuleKey(case_type_id=7, priority=Priority.MEDIUM): SlaTargets(30, 120, 80),
}


def test_case_type_rule_wins_over_the_default() -> None:
    assert match_rule(RULES, case_type_id=7, priority=Priority.MEDIUM) == SlaTargets(30, 120, 80)


def test_default_rule_is_used_when_the_type_has_none() -> None:
    assert match_rule(RULES, case_type_id=99, priority=Priority.MEDIUM) == SlaTargets(120, 480, 75)


def test_no_rule_for_the_priority_means_no_target() -> None:
    assert match_rule(RULES, case_type_id=7, priority=Priority.HIGH) is None
