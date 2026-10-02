"""Verification Agent (AGENTS.md 4.4): bildirimin gercek olma guveni, aciklanabilir sinyallerle."""

from datetime import UTC, datetime

import pytest

from app.agents.base import RULES_MODEL, AgentContext
from app.agents.verification import (
    VerificationAgent,
    VerificationInput,
    VerificationLevel,
    verification_level,
)

CTX = AgentContext(now=datetime(2026, 10, 7, 7, 0, tzinfo=UTC))
PLAIN = VerificationInput(
    has_photo=False,
    duplicate_count=0,
    location_consistency=None,
    reporter_case_count=0,
    reporter_rejected_count=0,
    verified_before_here=False,
    is_meaningful=True,
)


def _run(**changes: object) -> object:
    return VerificationAgent().run(PLAIN.model_copy(update=changes), CTX)


def _deltas(result: object) -> dict[str, float]:
    return {c.signal: c.delta for c in result.output.contributions}


@pytest.mark.parametrize(
    ("score", "level"),
    [
        (0.0, VerificationLevel.LOW),
        (0.39, VerificationLevel.LOW),
        (0.4, VerificationLevel.MEDIUM),
        (0.69, VerificationLevel.MEDIUM),
        (0.7, VerificationLevel.HIGH),
        (1.0, VerificationLevel.HIGH),
    ],
)
def test_levels(score: float, level: VerificationLevel) -> None:
    assert verification_level(score) is level


def test_plain_report_starts_at_the_base_score() -> None:
    result = _run()

    assert result.output.score == 0.4
    assert result.decision == "MEDIUM"
    assert result.model == RULES_MODEL
    assert result.output.contributions == []


def test_photo_and_consistent_location_make_it_trustworthy() -> None:
    result = _run(has_photo=True, location_consistency=True)

    # 0.40 + 0.20 + 0.15 (kayan nokta toplami yuvarlanir)
    assert result.output.score == 0.75
    assert result.output.level is VerificationLevel.HIGH
    assert _deltas(result) == {"PHOTO": 0.2, "LOCATION_CONSISTENT": 0.15}


@pytest.mark.parametrize(("count", "delta"), [(1, 0.15), (2, 0.15), (3, 0.25), (9, 0.25)])
def test_other_reports_of_the_same_problem_confirm_it(count: int, delta: float) -> None:
    assert _deltas(_run(duplicate_count=count))["DUPLICATES"] == delta


def test_contradicting_location_and_meaningless_text_lower_the_score() -> None:
    result = _run(location_consistency=False, is_meaningful=False)

    assert result.output.score == 0.05
    assert result.output.level is VerificationLevel.LOW
    assert _deltas(result) == {"LOCATION_MISMATCH": -0.15, "TEXT_MEANINGLESS": -0.2}


@pytest.mark.parametrize(
    ("cases", "rejected", "delta"),
    [
        (2, 2, None),  # gecmis cok kisa: yargiya varilmaz
        (10, 0, 0.1),  # guvenilir bildirim yapan
        (10, 3, None),  # arada: etkisiz
        (10, 5, -0.2),  # bildirimlerinin yarisi reddedilmis
    ],
)
def test_reporter_history(cases: int, rejected: int, delta: float | None) -> None:
    deltas = _deltas(_run(reporter_case_count=cases, reporter_rejected_count=rejected))

    assert deltas.get("REPORTER_HISTORY") == delta


def test_verified_problem_at_the_same_place_helps() -> None:
    assert _deltas(_run(verified_before_here=True))["VERIFIED_BEFORE"] == 0.1


def test_score_stays_between_zero_and_one() -> None:
    best = _run(
        has_photo=True,
        duplicate_count=5,
        location_consistency=True,
        reporter_case_count=10,
        verified_before_here=True,
    )
    worst = _run(
        location_consistency=False,
        is_meaningful=False,
        reporter_case_count=10,
        reporter_rejected_count=10,
    )

    assert (best.output.score, worst.output.score) == (1.0, 0.0)
