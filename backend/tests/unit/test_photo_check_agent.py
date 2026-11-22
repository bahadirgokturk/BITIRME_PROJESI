"""Photo Check Agent: fotografin onerdigi turler metinden cikan turle karsilastirilir."""

from datetime import UTC, datetime

from app.agents.base import AgentContext
from app.agents.photo_check import CONFLICT_FROM, PhotoCheckAgent, PhotoCheckInput
from app.agents.vision import TypeSuggestion

CTX = AgentContext(now=datetime(2026, 11, 14, 10, 0, tzinfo=UTC))


def _check(text_type: str, *suggestions: tuple[str, float]):  # type: ignore[no-untyped-def]
    inp = PhotoCheckInput(
        case_type_code=text_type,
        suggestions=[TypeSuggestion(case_type_code=c, confidence=p) for c, p in suggestions],
    )
    return PhotoCheckAgent().run(inp, CTX)


def test_photo_showing_the_same_type_agrees() -> None:
    result = _check("SOAP_EMPTY", ("SOAP_EMPTY", 0.8))

    assert result.decision == "AGREES"
    assert result.confidence == 0.8


def test_text_type_among_lower_suggestions_still_agrees() -> None:
    assert (
        _check("SOAP_EMPTY", ("TOILET_PAPER_EMPTY", 0.55), ("SOAP_EMPTY", 0.3)).decision == "AGREES"
    )


def test_confident_other_type_conflicts() -> None:
    result = _check("SOAP_EMPTY", ("WATER_LEAK", CONFLICT_FROM))

    assert result.decision == "CONFLICTS"
    assert result.reasons[0].evidence == {"photo_type": "WATER_LEAK", "text_type": "SOAP_EMPTY"}


def test_unsure_other_type_is_unclear_not_a_conflict() -> None:
    assert _check("SOAP_EMPTY", ("WATER_LEAK", CONFLICT_FROM - 0.01)).decision == "UNCLEAR"


def test_photo_without_suggestion_is_unclear() -> None:
    result = _check("SOAP_EMPTY")

    assert result.decision == "UNCLEAR"
    assert result.confidence is None
