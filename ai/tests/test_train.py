import csv
import json
from pathlib import Path

import joblib

from generators.sentence_templates import CAMPUS_TEMPLATES_PATH, load_templates
from generators.synthesize import CAMPUS_LOCATIONS_PATH, generate, load_location_phrases
from training.evaluate_model import evaluate_file
from training.train_classifier import train, write_artifacts

SAMPLES = generate(
    load_templates(CAMPUS_TEMPLATES_PATH),
    load_location_phrases(CAMPUS_LOCATIONS_PATH),
    per_type=30,
    seed=5,
)


def test_training_writes_the_model_and_its_metrics(tmp_path: Path) -> None:
    model, report = train(SAMPLES, seed=5)

    write_artifacts(model, report, tmp_path, seed=5)

    metrics = json.loads((tmp_path / "metrics.json").read_text(encoding="utf-8"))
    assert (tmp_path / "model.joblib").exists()
    assert metrics["sklearn_version"]
    assert metrics["seed"] == 5
    # Sentetik sonuc gercek basari gibi sunulmasin (docs/AGENTS.md 6.3)
    evaluation = metrics["evaluation"]
    assert evaluation["data"] == "synthetic-template-cv"
    # 5 katli sablon bazli capraz dogrulama: her ornek tam bir kez test edilir
    assert evaluation["n"] == len(SAMPLES)
    assert len(evaluation["folds"]) == 5
    assert evaluation["macro_f1_std"] >= 0
    assert evaluation["latency_ms"]["p50"] > 0


def test_final_model_is_trained_on_all_templates() -> None:
    # Olcum ayrilmis sablonlarla yapilir; teslim edilen model butun sablonlari gorur
    model, _ = train(SAMPLES, seed=5)

    assert set(model.classes_) == {s.label for s in SAMPLES}


def test_a_saved_model_is_scored_on_a_labeled_file(tmp_path: Path) -> None:
    model, report = train(SAMPLES, seed=5)
    write_artifacts(model, report, tmp_path, seed=5)
    labeled = tmp_path / "real.csv"
    with labeled.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["text", "label"])
        writer.writerows(
            [("b blok wc sabun yok", "SOAP_EMPTY"), ("asansör çalışmıyor", "ELEVATOR_FAILURE")]
        )

    result = evaluate_file(joblib.load(tmp_path / "model.joblib"), labeled)

    assert result["n"] == 2
    assert result["accuracy"] == 1.0
