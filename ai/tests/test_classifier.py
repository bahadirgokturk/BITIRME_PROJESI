from pathlib import Path

import joblib
import pytest
from sklearn.pipeline import Pipeline

from generators.sentence_templates import CAMPUS_TEMPLATES_PATH, load_templates
from generators.synthesize import CAMPUS_LOCATIONS_PATH, Sample, generate, load_location_phrases
from training.classifier import build_pipeline, evaluate, split_by_template
from training.normalization import normalize

TEMPLATES = load_templates(CAMPUS_TEMPLATES_PATH)
SAMPLES = generate(TEMPLATES, load_location_phrases(CAMPUS_LOCATIONS_PATH), per_type=40, seed=11)
SEED = 11


@pytest.fixture(scope="module")
def trained() -> tuple[Pipeline, list[Sample]]:
    train, test = split_by_template(SAMPLES, seed=SEED)
    pipeline = build_pipeline(seed=SEED)
    pipeline.fit([s.text for s in train], [s.label for s in train])
    return pipeline, test


def test_split_keeps_every_template_on_one_side_only() -> None:
    # Ayni sablonun farkli lokasyonlu kopyasi iki tarafa duserse test basarisi sisirilir
    train, test = split_by_template(SAMPLES, seed=SEED)

    assert not {s.template_id for s in train} & {s.template_id for s in test}
    assert {s.label for s in test} == set(TEMPLATES)
    assert 0 < len(test) < len(train)


def test_features_use_the_backend_normalize() -> None:
    from app.agents.text import normalize as backend_normalize

    pipeline = build_pipeline(seed=SEED)
    vectorizers = pipeline.named_steps["features"].transformer_list

    assert normalize is backend_normalize
    assert all(vectorizer.preprocessor is backend_normalize for _, vectorizer in vectorizers)


def test_model_recognises_unseen_everyday_sentences(trained: tuple[Pipeline, list[Sample]]) -> None:
    pipeline, _ = trained

    predicted = pipeline.predict(["tuvalette hiç sabun kalmamış", "eduroam bağlanmıyor yine"])

    assert list(predicted) == ["SOAP_EMPTY", "WIFI_FAILURE"]


def test_probabilities_cover_every_case_type(trained: tuple[Pipeline, list[Sample]]) -> None:
    pipeline, _ = trained

    probabilities = pipeline.predict_proba(["klima çalışmıyor"])[0]

    assert set(pipeline.classes_) == set(TEMPLATES)
    assert probabilities.sum() == pytest.approx(1.0)


def test_spelling_variants_get_the_same_answer(trained: tuple[Pipeline, list[Sample]]) -> None:
    pipeline, _ = trained

    loud, plain = pipeline.predict_proba(["WC'DE SABUN YOK!!", "wc de sabun yok"])

    assert loud == pytest.approx(plain)


def test_evaluation_reports_the_thesis_metrics(trained: tuple[Pipeline, list[Sample]]) -> None:
    pipeline, test = trained

    report = evaluate(pipeline, [s.text for s in test], [s.label for s in test])

    assert 0.0 <= report["accuracy"] <= 1.0
    assert 0.0 <= report["macro_f1"] <= 1.0
    assert set(report["per_class"]) == set(TEMPLATES)
    assert len(report["confusion_matrix"]["matrix"]) == len(report["confusion_matrix"]["labels"])
    assert report["latency_ms"]["p95"] >= report["latency_ms"]["p50"] >= 0


def test_saved_model_predicts_the_same_after_loading(
    trained: tuple[Pipeline, list[Sample]], tmp_path: Path
) -> None:
    pipeline, test = trained
    path = tmp_path / "model.joblib"

    joblib.dump(pipeline, path)
    loaded = joblib.load(path)

    texts = [s.text for s in test[:20]]
    assert list(loaded.predict(texts)) == list(pipeline.predict(texts))
