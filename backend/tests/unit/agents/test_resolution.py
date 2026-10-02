"""Resolution Agent (AGENTS.md 4.9): personel "tamamlandi" dediginde is gercekten bitmis mi.

Karar: RESOLVED (kapat), NEEDS_MORE_EVIDENCE (personele geri), REOPEN (yapilamamis; manager'a).
"""

from datetime import UTC, datetime

import pytest

from app.agents.base import RULES_MODEL, AgentContext
from app.agents.resolution import (
    DEFAULT_MIN_WORK_MINUTES,
    MIN_WORK_MINUTES,
    ResolutionAgent,
    ResolutionDecision,
    ResolutionInput,
)

CTX = AgentContext(now=datetime(2026, 10, 7, 7, 0, tzinfo=UTC))
DONE = ResolutionInput(
    completion_note="Sabunluklar dolduruldu, yedek sabun bırakıldı.",
    has_evidence_photo=False,
    work_minutes=15,
    case_type_code="SOAP_EMPTY",
)


def _run(**changes: object) -> object:
    return ResolutionAgent().run(DONE.model_copy(update=changes), CTX)


def _codes(result: object) -> list[str]:
    return [reason.code for reason in result.reasons]


def test_explained_work_of_a_reasonable_length_is_resolved() -> None:
    result = _run()

    assert result.decision == ResolutionDecision.RESOLVED
    assert result.model == RULES_MODEL
    assert _codes(result) == ["NOTE_OK", "DURATION_OK"]


@pytest.mark.parametrize("note", [None, "", "tamam", "  bitti   "])
def test_without_a_note_or_photo_more_evidence_is_needed(note: str | None) -> None:
    result = _run(completion_note=note)

    assert result.decision == ResolutionDecision.NEEDS_MORE_EVIDENCE
    assert "NOTE_TOO_SHORT" in _codes(result)
    assert "fotoğraf" in result.reasons[0].message


def test_a_photo_makes_a_short_note_enough() -> None:
    result = _run(completion_note=None, has_evidence_photo=True)

    assert result.decision == ResolutionDecision.RESOLVED
    assert "EVIDENCE_PHOTO" in _codes(result)


def test_suspiciously_quick_work_needs_more_evidence() -> None:
    result = _run(work_minutes=DEFAULT_MIN_WORK_MINUTES - 1)

    assert result.decision == ResolutionDecision.NEEDS_MORE_EVIDENCE
    assert _codes(result) == ["NOTE_OK", "TOO_QUICK"]


def test_the_minimum_work_time_depends_on_the_case_type() -> None:
    minimum = MIN_WORK_MINUTES["ELEVATOR_FAILURE"]

    too_quick = _run(case_type_code="ELEVATOR_FAILURE", work_minutes=minimum - 1)
    enough = _run(case_type_code="ELEVATOR_FAILURE", work_minutes=minimum)

    assert too_quick.decision == ResolutionDecision.NEEDS_MORE_EVIDENCE
    assert enough.decision == ResolutionDecision.RESOLVED


def test_a_photo_makes_quick_work_believable() -> None:
    result = _run(work_minutes=0, has_evidence_photo=True)

    assert result.decision == ResolutionDecision.RESOLVED


def test_unknown_case_type_uses_the_default_minimum() -> None:
    result = _run(case_type_code=None, work_minutes=DEFAULT_MIN_WORK_MINUTES)

    assert result.decision == ResolutionDecision.RESOLVED


@pytest.mark.parametrize(
    "note",
    [
        "Arıza giderilemedi, parça yok.",
        "Motor değişmeli; tedarik bekleniyor",
        "ONARILAMADI",
        "Kilit çözülemedi, çilingir lazım",
        "İş yapılamadı çünkü oda kilitliydi",
    ],
)
def test_a_note_saying_the_work_was_not_done_reopens_the_case(note: str) -> None:
    result = _run(completion_note=note, has_evidence_photo=True)

    assert result.decision == ResolutionDecision.REOPEN
    assert _codes(result)[0] == "NOT_DONE"
    assert result.reasons[0].evidence["phrase"]


def test_ordinary_words_are_not_mistaken_for_failure() -> None:
    result = _run(completion_note="Parçalar değiştirildi, sorun yok artık.")

    assert result.decision == ResolutionDecision.RESOLVED
