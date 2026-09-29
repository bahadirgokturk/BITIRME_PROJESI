"""Gorev durum tablosu: docs/WORKFLOW.md bolum 2 ile birebir (36 durum cifti tek tek denenir)."""

from itertools import product

import pytest

from app.core.errors import InvalidTransitionError
from app.models.enums import TaskStatus as T
from app.services.workflow import ensure_task_transition_allowed

EXPECTED: dict[T, set[T]] = {
    T.PENDING: {T.ACCEPTED, T.DECLINED, T.CANCELLED},
    T.ACCEPTED: {T.IN_PROGRESS, T.DECLINED, T.CANCELLED},
    T.IN_PROGRESS: {T.COMPLETED, T.CANCELLED},
    T.COMPLETED: set(),
    T.DECLINED: set(),
    T.CANCELLED: set(),
}


def test_expected_table_covers_every_status() -> None:
    assert set(EXPECTED) == set(T)


@pytest.mark.parametrize(("source", "target"), list(product(T, T)))
def test_task_transition_matches_the_workflow(source: T, target: T) -> None:
    if target in EXPECTED[source]:
        ensure_task_transition_allowed(source, target)
        return
    with pytest.raises(InvalidTransitionError):
        ensure_task_transition_allowed(source, target)
