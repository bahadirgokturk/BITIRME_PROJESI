"""Fotograftan tur onerisi olcumu (Vision Agent, docs/AGENTS.md 4.11).

Kampuste cekilen fotograflar tur koduyla adlandirilmis klasorlere konur (SOAP_EMPTY/,
TRASH_FULL/...); sorun gostermeyen fotograflar _NONE/ klasorune. Her fotograf gercek modelden ve
agent'tan gecer.

Olculenler:
- Kapsam: sorunlu fotograflarin kacinda oneri verildi ("anlasilamadi" demedi).
- Ilk oneri dogrulugu: oneri verilenlerde ve tumunde; ilk 3 icinde dogru tur.
- Yanlis alarm: sorun gostermeyen fotografa oneri verme orani.
- Tur bazinda sonuc ve en sik karisan tur ciftleri.

Fotograflar acik repoya konmaz (yuz, plaka olabilir): ai/data/raw/fotograflar altinda durur.
Kullanim (repo kokunden; model backend imajinda):
    docker compose run --rm -v "./ai/data/raw/fotograflar:/photos:ro" backend \
        python -m scripts.eval_photos /photos > ai/data/raw/rq-foto.md
Telefonlar HEIC kaydedebilir: atlanir; iPhone'da Ayarlar > Kamera > Formatlar > En Uyumlu (JPEG).
"""

import sys
from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

from app.agents.base import AgentContext
from app.agents.vision import NONE_LABEL, VisionAgent, VisionInput
from app.agents.vision_model import get_vision
from app.core.config import get_settings

CASE_TYPES_YAML = Path(__file__).resolve().parents[1] / "seeds/templates/campus/case_types.yaml"
IMAGE_SUFFIXES = frozenset({".jpg", ".jpeg", ".png", ".webp"})
TOP_K = 3
RATIO_DIGITS = 4
# Tabloda gosterilen en sik karisan cift sayisi
CONFUSION_LIMIT = 10


@dataclass(frozen=True)
class Photo:
    path: Path
    truth: str


def collect(root: Path, known: set[str]) -> tuple[list[Photo], list[Path]]:
    """Klasor adi gercek tur; resim olmayan ya da desteklenmeyen (HEIC) dosyalar atlanir."""
    photos: list[Photo] = []
    skipped: list[Path] = []
    for folder in sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith(".")):
        if folder.name not in known | {NONE_LABEL}:
            raise ValueError(f"Bilinmeyen tur klasoru: {folder.name} (tur kodu ya da _NONE olmali)")
        for path in sorted(p for p in folder.iterdir() if p.is_file()):
            if path.suffix.lower() not in IMAGE_SUFFIXES:
                skipped.append(path)
                continue
            photos.append(Photo(path=path, truth=folder.name))
    return photos, skipped


def _ratio(part: int, whole: int) -> float | None:
    return round(part / whole, RATIO_DIGITS) if whole else None


def evaluate(photos: Sequence[Photo], predict: Callable[[Photo], list[str]]) -> dict[str, Any]:
    answers = [(photo, predict(photo)) for photo in photos]
    problems = [(p, codes) for p, codes in answers if p.truth != NONE_LABEL]
    nones = [(p, codes) for p, codes in answers if p.truth == NONE_LABEL]
    suggested = [(p, codes) for p, codes in problems if codes]
    top1 = [(p, codes) for p, codes in suggested if codes[0] == p.truth]
    per_type: dict[str, dict[str, int]] = {}
    for photo, codes in problems:
        row = per_type.setdefault(photo.truth, {"n": 0, "top1": 0, "suggested": 0})
        row["n"] += 1
        row["suggested"] += bool(codes)
        row["top1"] += bool(codes) and codes[0] == photo.truth
    confusions = Counter(
        f"{photo.truth} -> {codes[0]}" for photo, codes in suggested if codes[0] != photo.truth
    )
    return {
        "n": len(photos),
        "problem_photos": len(problems),
        "coverage": _ratio(len(suggested), len(problems)),
        "top1_when_suggested": _ratio(len(top1), len(suggested)),
        "top1_overall": _ratio(len(top1), len(problems)),
        "top3_overall": _ratio(
            sum(p.truth in codes[:TOP_K] for p, codes in problems), len(problems)
        ),
        "none_photos": len(nones),
        "false_alarm_rate": _ratio(sum(bool(codes) for _, codes in nones), len(nones)),
        "per_type": dict(sorted(per_type.items())),
        "confusions": dict(confusions.most_common(CONFUSION_LIMIT)),
    }


def _pct(value: float | None) -> str:
    return "-" if value is None else f"%{value * 100:.1f}".replace(".", ",")


def markdown_report(report: dict[str, Any], skipped: int) -> str:
    """Tezdeki tablo: genel sonuc, tur bazinda sonuc, karisan turler."""
    lines = [
        f"# Fotograftan tur onerisi (n = {report['n']} fotograf)",
        "",
        "| Olcu | Deger |",
        "| --- | --- |",
        f"| Kapsam (oneri verilen sorunlu fotograf) | {_pct(report['coverage'])} |",
        f"| Ilk oneri dogru (oneri verilenlerde) | {_pct(report['top1_when_suggested'])} |",
        f"| Ilk oneri dogru (tum sorunlu fotograflarda) | {_pct(report['top1_overall'])} |",
        f"| Ilk {TOP_K} oneride dogru tur | {_pct(report['top3_overall'])} |",
        f"| Yanlis alarm (sorun yokken oneri, n = {report['none_photos']}) | "
        f"{_pct(report['false_alarm_rate'])} |",
        "",
        "| Tur | Fotograf | Ilk oneri dogru | Oneri verildi |",
        "| --- | --- | --- | --- |",
    ]
    lines += [
        f"| {code} | {row['n']} | {_pct(_ratio(row['top1'], row['n']))} | "
        f"{_pct(_ratio(row['suggested'], row['n']))} |"
        for code, row in report["per_type"].items()
    ]
    lines += ["", "En sik karisan turler (gercek -> ilk oneri):", ""]
    lines += [f"- {pair}: {count}" for pair, count in report["confusions"].items()] or ["- yok"]
    if skipped:
        lines += ["", f"Atlanan {skipped} dosya (resim degil ya da HEIC)."]
    return "\n".join(lines) + "\n"


def main() -> int:
    vision = get_vision(get_settings().vision_model_path)
    if vision is None:
        print("Goruntu modeli yok: komutu backend imajinda calistirin", file=sys.stderr)
        return 1
    known = {
        t["code"] for t in yaml.safe_load(CASE_TYPES_YAML.read_text(encoding="utf-8"))["case_types"]
    }
    photos, skipped = collect(Path(sys.argv[1]), known)
    agent = VisionAgent(vision.bank)
    ctx = AgentContext(now=datetime.now(UTC))

    def predict(photo: Photo) -> list[str]:
        embedding = vision.encoder.encode(photo.path.read_bytes())
        result = agent.run(VisionInput(image_embedding=embedding), ctx)
        return [s.case_type_code for s in result.output.suggestions]

    print(markdown_report(evaluate(photos, predict), skipped=len(skipped)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
