"""Classification modeli egitimi (E5-3).

1. Sentetik veri tohumla uretilir (generators/synthesize.py) ve CSV olarak kaydedilir.
2. Olcum: sablon bazli 5 katli capraz dogrulama; her ornek sablonunu gormemis modelle test edilir.
3. Teslim edilen model butun veriyle yeniden egitilir; metrics.json olcumu ve surumleri kaydeder.

Bu olcum sentetik veridedir. Gercek basari Google Form verisiyle olculur
(training/evaluate_model.py).

Kullanim (ai/ klasorunde):
    uv run python -m training.train_classifier --out models/classifier/v1

Ogrenen model (v2): mudur duzeltmeleri eklenir, gercek test cumleleri disarida birakilir:
    uv run python -m training.train_classifier --version 2.0 --out models/classifier/v2
        --feedback data/raw/feedback.csv --holdout data/raw/etiket.csv  (ayni satirda)
"""

import argparse
import csv
import json
import shutil
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import sklearn
from sklearn.pipeline import Pipeline

from generators.sentence_templates import CAMPUS_TEMPLATES_PATH, load_templates
from generators.synthesize import (
    CAMPUS_LOCATIONS_PATH,
    Sample,
    generate,
    load_location_phrases,
    write_csv,
)
from training.classifier import build_pipeline, cross_validate, latency_ms
from training.feedback import FEEDBACK_REPEAT, load_feedback
from training.report import write_report

MODEL_NAME = "classification"
DEFAULT_VERSION = "1.0"
ALGORITHM = "tfidf(char_wb 2-5 + word 1-2) + logistic_regression(balanced) + sigmoid calibration"
EVALUATION_DATA = "synthetic-template-cv"
# Olcume mudur duzeltmeleri de karisti (v2): sonuc saf sentetik degil, raporda belirtilir
EVALUATION_DATA_WITH_FEEDBACK = "synthetic-template-cv+feedback"
DEFAULT_PER_TYPE = 160
DEFAULT_SEED = 42
# Gecikme olcumu icin ornek sayisi (tek tek tahmin)
LATENCY_SAMPLE_SIZE = 200
# joblib sikistirma seviyesi: 3 boyutu belirgin kucultur, yukleme suresi pratikte degismez
MODEL_COMPRESSION = 3
# Backend'in yukledigi dosyalar (backend/ml_models/classifier/<surum>/)
PUBLISHED_FILES = ("model.joblib", "metrics.json")


@dataclass(frozen=True)
class RunInfo:
    seed: int
    version: str = DEFAULT_VERSION
    # Egitime eklenen mudur duzeltmesi sayisi (tekrarlar haric)
    feedback_samples: int = 0


def _fit(samples: Sequence[Sample], seed: int) -> Pipeline:
    pipeline = build_pipeline(seed=seed)
    pipeline.fit([s.text for s in samples], [s.label for s in samples])
    return pipeline


def train(samples: Sequence[Sample], *, seed: int) -> tuple[Pipeline, dict[str, Any]]:
    report = cross_validate(samples, seed=seed)
    model = _fit(samples, seed)
    texts = [s.text for s in samples[:LATENCY_SAMPLE_SIZE]]
    return model, {**report, "latency_ms": latency_ms(model, texts)}


def write_artifacts(model: Pipeline, report: dict[str, Any], out_dir: Path, run: RunInfo) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_dir / "model.joblib", compress=MODEL_COMPRESSION)
    metrics = {
        "model": MODEL_NAME,
        "version": run.version,
        "algorithm": ALGORITHM,
        # Backend modeli yuklerken ayni surumu kullanmali (pickle uyumu)
        "sklearn_version": sklearn.__version__,
        "seed": run.seed,
        "feedback_samples": run.feedback_samples,
        "classes": [str(code) for code in model.classes_],
        "evaluation": {
            "data": EVALUATION_DATA_WITH_FEEDBACK if run.feedback_samples else EVALUATION_DATA,
            **report,
        },
    }
    # Windows'ta da LF: dosya repoda, her makinede ayni cikmali
    (out_dir / "metrics.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    write_report(metrics, out_dir / "report.html")


def publish(out_dir: Path, target: Path) -> None:
    """Modeli backend'in yukledigi klasore kopyalar (ornek: ../backend/ml_models/classifier/v1)."""
    target.mkdir(parents=True, exist_ok=True)
    for name in PUBLISHED_FILES:
        shutil.copyfile(out_dir / name, target / name)


def _holdout_texts(sheet: Path | None) -> list[str]:
    if sheet is None:
        return []
    with sheet.open(encoding="utf-8-sig", newline="") as handle:
        return [row["text"] for row in csv.DictReader(handle)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Classification modelini egit ve olc")
    parser.add_argument("--per-type", type=int, default=DEFAULT_PER_TYPE)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--data-out", type=Path, default=Path("data/synthetic/campus.csv"))
    parser.add_argument("--out", type=Path, default=Path("models/classifier/v1"))
    parser.add_argument("--publish", type=Path, help="Modeli backend klasorune de kopyala")
    parser.add_argument("--version", default=DEFAULT_VERSION, help="Model surumu (or. 2.0)")
    parser.add_argument(
        "--feedback", type=Path, help="Mudur duzeltmeleri (backend scripts.export_feedback CSV'si)"
    )
    parser.add_argument(
        "--holdout", type=Path, help="Gercek test tablosu: buradaki cumleler egitime girmez"
    )
    args = parser.parse_args()
    templates = load_templates(CAMPUS_TEMPLATES_PATH)
    locations = load_location_phrases(CAMPUS_LOCATIONS_PATH)
    samples = generate(templates, locations, per_type=args.per_type, seed=args.seed)
    write_csv(samples, args.data_out)
    feedback = load_feedback(args.feedback, _holdout_texts(args.holdout)) if args.feedback else []
    model, report = train([*samples, *feedback], seed=args.seed)
    run = RunInfo(
        seed=args.seed, version=args.version, feedback_samples=len(feedback) // FEEDBACK_REPEAT
    )
    write_artifacts(model, report, args.out, run)
    if args.publish:
        publish(args.out, args.publish)
    summary = f"accuracy {report['accuracy']} | macro-F1 {report['macro_f1']}"
    print(f"{len(samples)} ornek | {summary} -> {args.out}")


if __name__ == "__main__":
    main()
