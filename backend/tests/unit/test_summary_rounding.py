"""Ozet metnindeki tam sayilar ekrandaki kutularla ayni yuvarlanir (frontend Math.round)."""

import pytest

from app.services.summary_service import screen_round


@pytest.mark.parametrize(
    ("value", "expected"),
    [(68.5, 69), (68.4, 68), (67.5, 68), (-2.5, -2), (-2.6, -3), (None, None)],
)
def test_halves_round_up_like_the_screens(value: float | None, expected: int | None) -> None:
    assert screen_round(value) == expected
