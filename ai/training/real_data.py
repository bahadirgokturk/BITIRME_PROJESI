"""Gercek veri hatti (test plani "AI degerlendirme"): formdan tabloya, tablodan RQ1 raporuna.

Uc adim, her biri ayri komut:

    # 1) Form cevaplari (Google Forms > Yanitlar > CSV indir) -> etiketleme tablosu
    uv run python -m training.real_data prepare --form data/raw/form.csv --out data/raw/etiket.csv

    # 2) Iki kisi label_a / label_b'yi doldurdu -> anlasma (kappa) ve cozulecek satirlar
    uv run python -m training.real_data agreement --sheet data/raw/etiket.csv

    # 3) Nihai etiketlerle model ve temel yontem olcumu -> JSON + tez tablosu (Markdown)
    uv run python -m training.real_data evaluate --sheet data/raw/etiket.csv \
        --model models/classifier/v1/model.joblib --out data/raw/rq1

Gercek cumleler acik repoya konmaz (KVKK, form metni): data/raw gitignore'dadir. Repoya yalniz
sayisal sonuc (JSON/Markdown) konabilir.
"""

import argparse
import csv
import json
from pathlib import Path
from typing import Any

import joblib
import yaml

from training.agreement import agreement, final_labels
from training.form_import import SHEET_COLUMNS, prepare_sheet
from training.real_eval import SEED_CASE_TYPES, KeywordBaseline, evaluate_real

# Sistemde otomatik karar esigi (backend MIN_CONFIDENCE_AUTO_DEFAULT); tabloda isaretlenir
SYSTEM_THRESHOLD = 0.7
PERCENT = 100


def _known_codes() -> set[str]:
    data = yaml.safe_load(SEED_CASE_TYPES.read_text(encoding="utf-8"))
    return {entry["code"] for entry in data["case_types"]}


def _read_sheet(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [{key: value or "" for key, value in row.items()} for row in csv.DictReader(handle)]


def prepare(form: Path, out: Path) -> int:
    sheet = prepare_sheet(form.read_text(encoding="utf-8-sig"))
    # utf-8-sig: Excel Turkce karakterleri dogru acsin
    with out.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SHEET_COLUMNS)
        writer.writeheader()
        writer.writerows(sheet)
    return len(sheet)


def _pct(value: float | None) -> str:
    return "-" if value is None else f"%{value * PERCENT:.1f}".replace(".", ",")


def markdown_report(report: dict[str, Any], kappa: float | None) -> str:
    """Tezdeki tablo: model ve temel yontem yan yana, sonra esik analizi."""
    model, baseline = report["model"], report["baseline"]
    lines = [
        f"# RQ1: Gercek veride siniflandirma (n = {report['n']})",
        "",
        f"Etiketleyici anlasmasi (Cohen's kappa): {kappa if kappa is not None else '-'}",
        "",
        "| Yontem | Dogruluk | Macro-F1 |",
        "| --- | --- | --- |",
        f"| Anahtar kelime (temel) | {_pct(baseline['accuracy'])} | {_pct(baseline['macro_f1'])} |",
        f"| TF-IDF + LR (model) | {_pct(model['accuracy'])} | {_pct(model['macro_f1'])} |",
        "",
        "| Esik | Otomatik giden | Otomatiklerin dogrulugu | Mudure giden |",
        "| --- | --- | --- | --- |",
    ]
    for row in report["thresholds"]:
        mark = " (sistem)" if row["threshold"] == SYSTEM_THRESHOLD else ""
        lines.append(
            f"| {row['threshold']:.2f}{mark} | {_pct(row['auto_share'])} | "
            f"{_pct(row['auto_accuracy'])} | {_pct(row['review_share'])} |"
        )
    return "\n".join(lines) + "\n"


def _print_agreement(sheet: Path) -> None:
    result = agreement(_read_sheet(sheet), _known_codes())
    print(f"Iki kisinin de etiketledigi: {result.both_labelled} | anlasilan: {result.agreed}")
    print(f"Cohen's kappa: {result.kappa}")
    for row in result.disagreements:
        print(f"  {row['id']}: {row['label_a']} / {row['label_b']} | {row['text']}")
    if result.disagreements:
        print("Anlasmazliklari birlikte cozup label_final sutununa yazin.")


def _evaluate(sheet: Path, model_path: Path, out: Path) -> None:
    rows = _read_sheet(sheet)
    known = _known_codes()
    labelled = final_labels(rows, known)
    report = evaluate_real(
        joblib.load(model_path),
        KeywordBaseline.from_seed(),
        [row["text"] for row in labelled],
        [row["label"] for row in labelled],
    )
    kappa = agreement(rows, known).kappa
    out.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({**report, "kappa": kappa}, ensure_ascii=False, indent=2) + "\n"
    (out / "rq1.json").write_text(payload, encoding="utf-8", newline="\n")
    summary = markdown_report(report, kappa)
    (out / "rq1.md").write_text(summary, encoding="utf-8", newline="\n")
    print(summary)


def main() -> None:
    parser = argparse.ArgumentParser(description="Gercek veri: tablo, anlasma, olcum")
    commands = parser.add_subparsers(dest="command", required=True)
    step = commands.add_parser("prepare", help="Form CSV'sinden etiketleme tablosu")
    step.add_argument("--form", type=Path, required=True)
    step.add_argument("--out", type=Path, required=True)
    step = commands.add_parser("agreement", help="Iki etiketleyicinin anlasmasi")
    step.add_argument("--sheet", type=Path, required=True)
    step = commands.add_parser("evaluate", help="Model ve temel yontem olcumu")
    step.add_argument("--sheet", type=Path, required=True)
    step.add_argument("--model", type=Path, required=True)
    step.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "prepare":
        print(f"{prepare(args.form, args.out)} satir yazildi: {args.out}")
    elif args.command == "agreement":
        _print_agreement(args.sheet)
    else:
        _evaluate(args.sheet, args.model, args.out)


if __name__ == "__main__":
    main()
