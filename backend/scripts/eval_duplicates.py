"""Mukerrer tespiti olcumu (test plani "Mukerrer tespiti", docs/TESTING.md).

Formda konum ve zaman olmadigi icin ciftler elle kurulur: ayni yer + ayni tur + yakin zaman (ayni
sorun) ve ayni tur + farkli yer (farkli sorun). Her cift gercek Duplicate Agent'tan gecer; A once
acilmis bildirim, B `minutes_apart` dakika sonra gelen yeni bildirimdir. Tur, siniflandirmadan
bagimsiz olcmek icin ciftteki etiketten alinir.

Iki kural raporlanir: otomatik birlestirme (skor >= 0.80) ve mudure soran dahil (skor >= 0.60).

Kullanim (repo kokunden; ciftler ai/data/raw altinda, acik repoya girmez):
    docker compose exec -T backend python -m scripts.eval_duplicates \
        < ai/data/raw/ciftler.csv > ai/data/raw/rq-duplicate.md

Bos sablon: backend/scripts/templates/duplicate_pairs.csv (ornek iki satirla).
"""

import csv
import sys
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, TextIO

import yaml

from app.agents.base import AgentContext
from app.agents.duplicate import (
    DuplicateAgent,
    DuplicateCandidate,
    DuplicateDecision,
    DuplicateInput,
)

LOCATIONS_YAML = Path(__file__).resolve().parents[1] / "seeds/templates/campus/locations.yaml"
COLUMNS = (
    "pair_id",
    "text_a",
    "location_a",
    "type_a",
    "text_b",
    "location_b",
    "type_b",
    "minutes_apart",
    "same",
)
PATH_SEPARATOR = "/"
# "1", "evet", "true": ayni sorun
TRUE_VALUES = frozenset({"1", "evet", "true", "e", "yes"})
RATIO_DIGITS = 4
# Olcumde zaman sabit bir gune baglanir; yalniz iki bildirim arasindaki fark onemlidir
REFERENCE_TIME = datetime(2026, 1, 5, 10, 0, tzinfo=UTC)
CANDIDATE_ID = 1


@dataclass(frozen=True)
class Pair:
    pair_id: str
    text_a: str
    location_a: str
    type_a: str
    text_b: str
    location_b: str
    type_b: str
    minutes_apart: int
    same: bool


def location_paths(tree: Iterable[dict[str, Any]], parent: str = "") -> dict[str, str]:
    """Seed agacindan kod -> materialized path (KMP/A/A-1/A-1-WCE)."""
    paths: dict[str, str] = {}
    for node in tree:
        path = f"{parent}{PATH_SEPARATOR}{node['code']}" if parent else node["code"]
        paths[node["code"]] = path
        paths.update(location_paths(node.get("children") or [], path))
    return paths


def _seed_paths() -> dict[str, str]:
    data = yaml.safe_load(LOCATIONS_YAML.read_text(encoding="utf-8"))
    return location_paths(data["locations"])


def read_pairs(source: TextIO, paths: dict[str, str]) -> list[Pair]:
    pairs = []
    for row in csv.DictReader(source):
        pair = Pair(
            pair_id=row["pair_id"],
            text_a=row["text_a"],
            location_a=row["location_a"].strip(),
            type_a=row["type_a"].strip(),
            text_b=row["text_b"],
            location_b=row["location_b"].strip(),
            type_b=row["type_b"].strip(),
            minutes_apart=int(row["minutes_apart"]),
            same=row["same"].strip().lower() in TRUE_VALUES,
        )
        if pair.minutes_apart < 0:
            raise ValueError(f"{pair.pair_id}: B, A'dan once acilamaz (minutes_apart >= 0)")
        unknown = {pair.location_a, pair.location_b} - paths.keys()
        if unknown:
            raise ValueError(f"{pair.pair_id}: bilinmeyen konum kodu {sorted(unknown)}")
        pairs.append(pair)
    return pairs


def _run(pair: Pair, paths: dict[str, str]) -> tuple[str, float]:
    ids = {code: index for index, code in enumerate(paths)}
    reported_at = REFERENCE_TIME + timedelta(minutes=pair.minutes_apart)
    candidate = DuplicateCandidate(
        case_id=CANDIDATE_ID,
        text=pair.text_a,
        case_type_code=pair.type_a,
        location_id=ids[pair.location_a],
        location_path=paths[pair.location_a],
        created_at=REFERENCE_TIME,
        duplicate_count=0,
    )
    inp = DuplicateInput(
        text=pair.text_b,
        case_type_code=pair.type_b,
        location_id=ids[pair.location_b],
        location_path=paths[pair.location_b],
        reported_at=reported_at,
        candidates=[candidate],
    )
    result = DuplicateAgent().run(inp, AgentContext(now=reported_at))
    return result.decision, result.confidence


def predict(pair: Pair, paths: dict[str, str]) -> str:
    return _run(pair, paths)[0]


def _ratio(part: int, whole: int) -> float | None:
    return round(part / whole, RATIO_DIGITS) if whole else None


def confusion(truths: Sequence[bool], predicted: Sequence[bool]) -> dict[str, Any]:
    pairs = list(zip(truths, predicted, strict=True))
    tp = sum(t and p for t, p in pairs)
    fp = sum(p and not t for t, p in pairs)
    fn = sum(t and not p for t, p in pairs)
    precision = _ratio(tp, tp + fp)
    recall = _ratio(tp, tp + fn)
    f1 = (
        round(2 * precision * recall / (precision + recall), RATIO_DIGITS)
        if precision and recall
        else None
    )
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": len(pairs) - tp - fp - fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def evaluate(pairs: Sequence[Pair], paths: dict[str, str]) -> dict[str, Any]:
    if not pairs:
        raise ValueError("Cift yok: once ciftler.csv doldurulmali")
    runs = [_run(pair, paths) for pair in pairs]
    truths = [pair.same for pair in pairs]
    decisions = [decision for decision, _ in runs]
    strict = [d == DuplicateDecision.DUPLICATE for d in decisions]
    errors = [
        {**asdict(pair), "decision": decision, "score": round(score, RATIO_DIGITS)}
        for pair, (decision, score), merged in zip(pairs, runs, strict, strict=True)
        if merged != pair.same
    ]
    return {
        "n": len(pairs),
        "positives": sum(truths),
        "strict": confusion(truths, strict),
        "lenient": confusion(truths, [d != DuplicateDecision.NEW_CASE for d in decisions]),
        "errors": errors,
    }


def _pct(value: float | None) -> str:
    return "-" if value is None else f"%{value * 100:.1f}".replace(".", ",")


def markdown_report(report: dict[str, Any]) -> str:
    """Tezdeki tablo: iki kural yan yana, sonra yanlis karar verilen ciftler."""
    lines = [
        f"# Mukerrer tespiti (n = {report['n']} cift, {report['positives']} ayni sorun)",
        "",
        "| Kural | Precision | Recall | F1 | TP | FP | FN | TN |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for label, key in (
        ("Otomatik birlestirme (>= 0,80)", "strict"),
        ("Mudure soran dahil (>= 0,60)", "lenient"),
    ):
        m = report[key]
        lines.append(
            f"| {label} | {_pct(m['precision'])} | {_pct(m['recall'])} | {_pct(m['f1'])} | "
            f"{m['tp']} | {m['fp']} | {m['fn']} | {m['tn']} |"
        )
    lines += ["", "Otomatik birlestirmede yanlis karar verilen ciftler:", ""]
    lines += [
        f"- {e['pair_id']}: beklenen {'ayni' if e['same'] else 'farkli'}, "
        f"karar {e['decision']} (skor {e['score']})"
        for e in report["errors"]
    ] or ["- yok"]
    return "\n".join(lines) + "\n"


def main() -> None:
    paths = _seed_paths()
    report = evaluate(read_pairs(sys.stdin, paths), paths)
    print(markdown_report(report))


if __name__ == "__main__":
    main()
