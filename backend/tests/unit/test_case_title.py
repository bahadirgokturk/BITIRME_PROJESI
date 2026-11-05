"""Bos baslikta aciklamadan uretilen baslik: kelime ortasindan kesilmez (E3-1)."""

import pytest

from app.core.constants import CASE_TITLE_FROM_DESCRIPTION_LENGTH
from app.services.case_service import title_from

LIMIT = CASE_TITLE_FROM_DESCRIPTION_LENGTH


def test_short_description_is_used_as_is() -> None:
    assert title_from("  Tuvalette sabun bitmiş.  ") == "Tuvalette sabun bitmiş."


def test_long_description_is_cut_at_a_word_boundary_with_an_ellipsis() -> None:
    description = "Sınıfta yanık kokusu gibi garip bir koku var, nereden geldiği belli değil."

    title = title_from(description)

    assert title == "Sınıfta yanık kokusu gibi garip bir koku var, nereden…"
    assert len(title) <= LIMIT + 1


@pytest.mark.parametrize(
    "description",
    [
        "Koridordaki lambalar yanıp sönüyor ve bazıları tamamen kapanmış, karanlık kalıyor.",
        "A blok zemin kattaki erkek tuvaletinde musluk sürekli akıyor; su israf oluyor gerçekten.",
    ],
)
def test_title_never_ends_with_a_broken_word_or_punctuation(description: str) -> None:
    title = title_from(description)
    words = title.removesuffix("…").split()

    assert description.startswith(title.removesuffix("…"))
    assert words[-1] in {word.rstrip(",;:.") for word in description.split()}
    assert not title.removesuffix("…").endswith((",", ";", ":", " "))


def test_a_single_very_long_word_is_cut_hard() -> None:
    # Bosluk yoksa kelime sinirina geri donulemez; yine de sinir asilmaz
    title = title_from("a" * (LIMIT * 2))

    assert title == "a" * LIMIT + "…"
