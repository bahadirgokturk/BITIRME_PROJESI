"""Etiketleyiciler arasi anlasma (test plani adim 2): Cohen's kappa ve nihai etiket.

Iki kisi label_a ve label_b'yi birbirinden bagimsiz doldurur. Anlastiklari satirda nihai etiket
odur; anlasmazlik ekipce cozulup label_final'a yazilir. Cozulmemis satir test setine girmez.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from sklearn.metrics import cohen_kappa_score

KAPPA_DIGITS = 4


class InvalidLabelError(ValueError):
    """Tabloda bilinmeyen bildirim turu kodu var (yazim hatasi)."""


@dataclass(frozen=True)
class Agreement:
    # Iki kisinin de etiketledigi satir sayisi
    both_labelled: int
    agreed: int
    kappa: float | None
    disagreements: list[dict[str, str]]


def _code(value: str) -> str:
    return value.strip().upper()


def _check(rows: Iterable[dict[str, str]], known: set[str]) -> None:
    wrong = [
        f"{row['id']}: {row[column]}"
        for row in rows
        for column in ("label_a", "label_b", "label_final")
        if row.get(column, "").strip() and _code(row[column]) not in known
    ]
    if wrong:
        raise InvalidLabelError("Bilinmeyen tur kodu: " + ", ".join(wrong))


def agreement(rows: Sequence[dict[str, str]], known: set[str]) -> Agreement:
    _check(rows, known)
    pairs = [
        (row, _code(row["label_a"]), _code(row["label_b"]))
        for row in rows
        if row["label_a"].strip() and row["label_b"].strip()
    ]
    if not pairs:
        return Agreement(both_labelled=0, agreed=0, kappa=None, disagreements=[])
    a = [first for _, first, _ in pairs]
    b = [second for _, _, second in pairs]
    # Tek bir tur varsa kappa tanimsizdir (beklenen anlasma 1); tam anlasma 1 sayilir
    kappa = 1.0 if len(set(a) | set(b)) == 1 else float(cohen_kappa_score(a, b))
    return Agreement(
        both_labelled=len(pairs),
        agreed=sum(first == second for _, first, second in pairs),
        kappa=round(kappa, KAPPA_DIGITS),
        disagreements=[
            {"id": row["id"], "text": row["text"], "label_a": first, "label_b": second}
            for row, first, second in pairs
            if first != second
        ],
    )


def final_labels(rows: Sequence[dict[str, str]], known: set[str]) -> list[dict[str, str]]:
    """Test seti: (id, text, label). Once ekibin karari, yoksa iki kisinin ortak etiketi."""
    _check(rows, known)
    labelled = []
    for row in rows:
        first, second, settled = (
            _code(row["label_a"]),
            _code(row["label_b"]),
            _code(row["label_final"]),
        )
        label = settled or (first if first and first == second else "")
        if label:
            labelled.append({"id": row["id"], "text": row["text"], "label": label})
    return labelled
