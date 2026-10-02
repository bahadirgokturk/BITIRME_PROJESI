"""Kayitli modeli etiketli bir CSV ile olcer (docs/AGENTS.md 6.3: test seti gercek veriden).

CSV sutunlari: text,label (label = case type kodu, docs/DEPARTMENTS.md). Google Form verisi ekipce
etiketlenip ai/data/labeled/ altina konur; sonuc tezdeki "gercek veri" basarisidir.

Kullanim:
    uv run python -m training.evaluate_model \
        --model models/classifier/v1/model.joblib --data data/labeled/real.csv
"""

import argparse
import csv
import json
from pathlib import Path
from typing import Any

import joblib
from sklearn.pipeline import Pipeline

from training.classifier import evaluate


def evaluate_file(model: Pipeline, data: Path) -> dict[str, Any]:
    with data.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return evaluate(model, [row["text"] for row in rows], [row["label"] for row in rows])


def main() -> None:
    parser = argparse.ArgumentParser(description="Modeli etiketli veriyle olc")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--out", type=Path, help="Sonucu JSON olarak da yaz")
    args = parser.parse_args()
    result = evaluate_file(joblib.load(args.model), args.data)
    print(f"n={result['n']} | accuracy {result['accuracy']} | macro-F1 {result['macro_f1']}")
    if args.out:
        args.out.write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )


if __name__ == "__main__":
    main()
