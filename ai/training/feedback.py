"""Ogrenen model (v2): mudurun tur duzeltmeleri egitim ornegi olur (docs/AGENTS.md 6).

Kaynak: backend `python -m scripts.export_feedback` CSV'si (text,label,...). Duzeltme gercek ve
bir insanin dogruladigi bir ornektir; bu yuzden sentetik sablonlardan fazla agirlik alir (tekrar).
Gercek test setindeki cumleler egitime girmez: olcum durust kalir.
"""

import csv
from collections.abc import Iterable
from pathlib import Path

from generators.synthesize import Sample
from training.normalization import normalize

# Bir duzeltme kac sentetik ornek agirliginda; sablon basina ~10 sentetik cumle var
FEEDBACK_REPEAT = 5
FEEDBACK_GROUP_PREFIX = "FEEDBACK#"


def _key(text: str) -> str:
    return normalize(text)


def load_feedback(path: Path, holdout: Iterable[str]) -> list[Sample]:
    excluded = {_key(text) for text in holdout}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = [row for row in csv.DictReader(handle) if _key(row["text"]) not in excluded]
    return [
        # Ayni duzeltmenin kopyalari tek grup: capraz dogrulamada birlikte egitime ya da teste gider
        Sample(text=row["text"], label=row["label"], template_id=f"{FEEDBACK_GROUP_PREFIX}{index}")
        for index, row in enumerate(rows)
        for _ in range(FEEDBACK_REPEAT)
    ]
