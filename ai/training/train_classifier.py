"""Classification modeli egitimi (E5-3).

1. Sentetik veri tohumla uretilir (generators/synthesize.py) ve CSV olarak kaydedilir.
2. Olcum: sablon bazli 5 katli capraz dogrulama; her ornek sablonunu gormemis modelle test edilir.
3. Teslim edilen model butun veriyle yeniden egitilir; metrics.json olcumu ve surumleri kaydeder.

Bu olcum sentetik veridedir. Gercek basari Google Form verisiyle olculur
(training/evaluate_model.py).

Kullanim (ai/ klasorunde):
    uv run python -m training.train_classifier --out models/classifier/v1
"""

import argparse
import json
import shutil
from collections.abc import Sequence
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
from training.report import write_report

MODEL_NAME = "classification"
MODEL_VERSION = "1.0"
ALGORITHM = "tfidf(char_wb 2-5 + word 1-2) + logistic_regression(balanced) + sigmoid calibration"
EVALUATION_DATA = "synthetic-template-cv"
DEFAULT_PER_TYPE = 160
DEFAULT_SEED = 42
# Gecikme olcumu icin ornek sayisi (tek tek tahmin)
LATENCY_SAMPLE_SIZE = 200
# joblib sikistirma seviyesi: 3 boyutu belirgin kucultur, yukleme suresi pratikte degismez
MODEL_COMPRESSION = 3
# Backend'in yukledigi dosyalar (backend/ml_models/classifier/<surum>/)
PUBLISHED_FILES = ("model.joblib", "metrics.json")


def _fit(samples: Sequence[Sample], seed: int) -> Pipeline:
    pipeline = build_pipeline(seed=seed)
    pipeline.fit([s.text for s in samples], [s.label for s in samples])
    return pipeline


def train(samples: Sequence[Sample], *, seed: int) -> tuple[Pipeline, dict[str, Any]]:
    report = cross_validate(samples, seed=seed)
    model = _fit(samples, seed)
    texts = [s.text for s in samples[:LATENCY_SAMPLE_SIZE]]
    return model, {**report, "latency_ms": latency_ms(model, texts)}


def write_artifacts(model: Pipeline, report: dict[str, Any], out_dir: Path, *, seed: int) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_dir / "model.joblib", compress=MODEL_COMPRESSION)
    metrics = {
        "model": MODEL_NAME,
        "version": MODEL_VERSION,
        "algorithm": ALGORITHM,
        # Backend modeli yuklerken ayni surumu kullanmali (pickle uyumu)
        "sklearn_version": sklearn.__version__,
        "seed": seed,
        "classes": [str(code) for code in model.classes_],
        "evaluation": {"data": EVALUATION_DATA, **report},
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Classification modelini egit ve olc")
    parser.add_argument("--per-type", type=int, default=DEFAULT_PER_TYPE)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--data-out", type=Path, default=Path("data/synthetic/campus.csv"))
    parser.add_argument("--out", type=Path, default=Path("models/classifier/v1"))
    parser.add_argument("--publish", type=Path, help="Modeli backend klasorune de kopyala")
    args = parser.parse_args()
    templates = load_templates(CAMPUS_TEMPLATES_PATH)
    locations = load_location_phrases(CAMPUS_LOCATIONS_PATH)
    samples = generate(templates, locations, per_type=args.per_type, seed=args.seed)
    write_csv(samples, args.data_out)
    model, report = train(samples, seed=args.seed)
    write_artifacts(model, report, args.out, seed=args.seed)
    if args.publish:
        publish(args.out, args.publish)
    summary = f"accuracy {report['accuracy']} | macro-F1 {report['macro_f1']}"
    print(f"{len(samples)} ornek | {summary} -> {args.out}")


if __name__ == "__main__":
    main()
