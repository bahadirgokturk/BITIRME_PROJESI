"""Evidence Check Agent (AGENTS.md 4.13): kanit fotografi bildirimdeki yerden mi."""

from datetime import UTC, datetime

from app.agents.base import RULES_MODEL, AgentContext
from app.agents.evidence_check import (
    SAME_PLACE_FROM,
    EvidenceCheckAgent,
    EvidenceCheckDecision,
    EvidenceCheckInput,
)

CTX = AgentContext(now=datetime(2026, 11, 23, 9, 0, tzinfo=UTC))


def _run(similarities: list[float]) -> object:
    return EvidenceCheckAgent().run(EvidenceCheckInput(similarities=similarities), CTX)


def test_the_most_similar_report_photo_decides() -> None:
    # Bildirimde iki fotograf: biri baska acidan; en benzeri yeterli
    result = _run([0.62, SAME_PLACE_FROM])

    assert result.decision == EvidenceCheckDecision.SAME_PLACE
    assert result.confidence == SAME_PLACE_FROM
    assert result.model == RULES_MODEL


def test_a_photo_unlike_every_report_photo_is_a_different_place() -> None:
    result = _run([0.71, SAME_PLACE_FROM - 0.001])

    assert result.decision == EvidenceCheckDecision.DIFFERENT_PLACE
    [reason] = result.reasons
    assert reason.evidence == {"similarity": 0.799, "threshold": SAME_PLACE_FROM}
    assert "fotoğraf ekleyin" in reason.message


def test_without_a_report_photo_nothing_is_compared() -> None:
    result = _run([])

    assert result.decision == EvidenceCheckDecision.NO_REFERENCE
    assert result.confidence is None
