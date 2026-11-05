"""Durum gecis tablosu: docs/WORKFLOW.md bolum 1'deki diyagramla birebir ayni olmali.

Beklenen tablo koddan bagimsiz, diyagramdan yeniden yazildi; ikisi ayrisirsa test kirmizi olur.
196 (14 x 14) durum cifti tek tek denenir: izinli olan gecer, digerleri 409 hatasi uretir.
"""

from itertools import product

import pytest

from app.core.errors import InvalidTransitionError
from app.models.enums import CaseStatus as S
from app.services.workflow import ensure_transition_allowed

EXPECTED: dict[S, set[S]] = {
    S.NEW: {S.ANALYZING},
    S.ANALYZING: {S.CLASSIFIED, S.NEEDS_INFO, S.MERGED, S.ESCALATED, S.REJECTED},
    S.NEEDS_INFO: {S.ANALYZING, S.REJECTED},
    S.CLASSIFIED: {S.ASSIGNED, S.ESCALATED, S.MERGED, S.REJECTED},
    S.ESCALATED: {S.ASSIGNED, S.MERGED, S.REJECTED},
    S.ASSIGNED: {S.ACCEPTED, S.ASSIGNED, S.ESCALATED},
    S.ACCEPTED: {S.IN_PROGRESS, S.ASSIGNED, S.ESCALATED},
    S.IN_PROGRESS: {S.RESOLVED, S.ESCALATED},
    S.RESOLVED: {S.VERIFICATION},
    S.VERIFICATION: {S.CLOSED, S.IN_PROGRESS, S.REOPENED},
    S.CLOSED: {S.REOPENED},
    S.REOPENED: {S.ASSIGNED, S.ESCALATED},
    S.REJECTED: set(),
    S.MERGED: set(),
}


def test_expected_table_covers_every_status() -> None:
    assert set(EXPECTED) == set(S)


@pytest.mark.parametrize(("source", "target"), list(product(S, S)))
def test_transition_matches_the_workflow_diagram(source: S, target: S) -> None:
    if target in EXPECTED[source]:
        ensure_transition_allowed(source, target)
        return
    with pytest.raises(InvalidTransitionError) as error:
        ensure_transition_allowed(source, target)
    assert error.value.details == {"from_status": source, "to_status": target}


@pytest.mark.parametrize("terminal", [S.REJECTED, S.MERGED])
def test_terminal_statuses_have_no_way_out(terminal: S) -> None:
    for target in S:
        with pytest.raises(InvalidTransitionError):
            ensure_transition_allowed(terminal, target)
