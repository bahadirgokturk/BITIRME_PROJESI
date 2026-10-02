"""Priority Agent (AGENTS.md 4.5): aciklanabilir etki skoru ve oncelik bandi."""

from datetime import UTC, datetime

import pytest

from app.agents.base import RULES_MODEL, AgentContext
from app.agents.priority import PriorityAgent, PriorityInput, priority_band
from app.models.enums import Priority

# 2026-10-07 Carsamba; Turkiye UTC+3
WEDNESDAY_10_LOCAL = AgentContext(now=datetime(2026, 10, 7, 7, 0, tzinfo=UTC))
WEDNESDAY_20_LOCAL = AgentContext(now=datetime(2026, 10, 7, 17, 0, tzinfo=UTC))
SATURDAY_10_LOCAL = AgentContext(now=datetime(2026, 10, 10, 7, 0, tzinfo=UTC))

SOAP_IN_WC = PriorityInput(
    base_severity=20,
    base_priority=Priority.LOW,
    is_safety_related=False,
    safety_signal=False,
    urgency_hints=[],
    location_importance=60,
)
ELECTRICAL = PriorityInput(
    base_severity=80,
    base_priority=Priority.HIGH,
    is_safety_related=True,
    safety_signal=False,
    urgency_hints=[],
    location_importance=40,
)


def _points(result: object) -> dict[str, float]:
    return {c.signal: c.points for c in result.output.contributions}


@pytest.mark.parametrize(
    ("score", "band"),
    [
        (0, Priority.LOW),
        (39, Priority.LOW),
        (40, Priority.MEDIUM),
        (64, Priority.MEDIUM),
        (65, Priority.HIGH),
        (84, Priority.HIGH),
        (85, Priority.CRITICAL),
        (100, Priority.CRITICAL),
    ],
)
def test_bands(score: int, band: Priority) -> None:
    assert priority_band(score) is band


def test_single_soap_report_is_low_and_explained() -> None:
    result = PriorityAgent().run(SOAP_IN_WC, WEDNESDAY_10_LOCAL)

    # siddet 20 -> 8, lokasyon 60 -> 9, ders saati 5
    assert _points(result) == {"SEVERITY": 8, "LOCATION": 9, "TIME": 5}
    assert result.output.impact_score == 22
    assert result.decision == "LOW"
    assert result.model == RULES_MODEL
    assert all(c.max_points > 0 for c in result.output.contributions)


def test_duplicates_and_recurrence_raise_the_priority() -> None:
    crowded = SOAP_IN_WC.model_copy(update={"duplicate_count": 5, "recent_similar_count": 4})

    result = PriorityAgent().run(crowded, WEDNESDAY_10_LOCAL)

    # 8 + 9 + 5 + 10 (5 tekrar) + 8 (son 30 gunde 4 benzer) = 40
    assert _points(result)["DUPLICATES"] == 10
    assert _points(result)["RECURRENCE"] == 8
    assert result.output.priority is Priority.MEDIUM


def test_signal_caps_keep_each_bar_within_its_range() -> None:
    flooded = SOAP_IN_WC.model_copy(
        update={"duplicate_count": 50, "recent_similar_count": 50, "urgency_hints": ["a", "b", "c"]}
    )

    points = _points(PriorityAgent().run(flooded, WEDNESDAY_10_LOCAL))

    assert (points["DUPLICATES"], points["RECURRENCE"], points["URGENCY"]) == (10, 10, 10)


def test_safety_related_type_gets_the_safety_bonus() -> None:
    result = PriorityAgent().run(ELECTRICAL, WEDNESDAY_10_LOCAL)

    # 32 + 30 + 6 + 5 = 73
    assert _points(result)["SAFETY"] == 30
    assert result.output.priority is Priority.HIGH


def test_safety_words_in_the_text_make_it_critical() -> None:
    sparks = ELECTRICAL.model_copy(update={"safety_signal": True, "urgency_hints": ["kivilcim"]})

    result = PriorityAgent().run(sparks, WEDNESDAY_10_LOCAL)

    assert result.output.impact_score >= 85
    assert result.output.priority is Priority.CRITICAL
    assert "SAFETY_FLOOR" in {r.code for r in result.reasons}


def test_case_type_starting_priority_is_a_floor() -> None:
    # Asansor arizasi tur olarak HIGH baslar; sinyaller dusuk olsa da asagi inmez
    elevator = SOAP_IN_WC.model_copy(
        update={"base_severity": 60, "base_priority": Priority.HIGH, "location_importance": 0}
    )

    result = PriorityAgent().run(elevator, SATURDAY_10_LOCAL)

    assert result.output.impact_score == 65
    assert "BASE_PRIORITY_FLOOR" in {r.code for r in result.reasons}


@pytest.mark.parametrize(
    ("ctx", "points"),
    [(WEDNESDAY_10_LOCAL, 5), (WEDNESDAY_20_LOCAL, 0), (SATURDAY_10_LOCAL, 0)],
)
def test_class_hours_add_time_sensitivity(ctx: AgentContext, points: int) -> None:
    assert _points(PriorityAgent().run(SOAP_IN_WC, ctx)).get("TIME", 0) == points


def test_score_never_exceeds_100() -> None:
    everything = ELECTRICAL.model_copy(
        update={
            "base_severity": 100,
            "safety_signal": True,
            "location_importance": 100,
            "duplicate_count": 9,
            "recent_similar_count": 9,
            "urgency_hints": ["a", "b"],
        }
    )

    assert PriorityAgent().run(everything, WEDNESDAY_10_LOCAL).output.impact_score == 100


def test_half_points_round_up() -> None:
    # Lokasyon onemi 70 -> 10.5 puan; bankaci yuvarlamasi 10 verirdi, yukari yuvarlanir
    wc = SOAP_IN_WC.model_copy(update={"location_importance": 70})

    assert _points(PriorityAgent().run(wc, WEDNESDAY_10_LOCAL))["LOCATION"] == 11
