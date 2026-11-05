"""Classification modeli v1 (E5-3, docs/AGENTS.md 4.2).

TF-IDF (karakter + kelime) + Logistic Regression.

Karakter n-gram Turkce eklere ("sabunluk", "sabunu") lemmatizer olmadan dayanir; kalibrasyon guven
skorunu Supervisor esiginde kullanilabilir yapar. Metin once backend'in normalize()'inden gecer.
"""

import time
from collections.abc import Iterator, Sequence
from typing import Any

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import FeatureUnion, Pipeline

from generators.synthesize import Sample
from training.normalization import normalize

# Karakter n-gram araligi: 2-5 harf Turkce kok + ek parcalarini yakalar (docs/AGENTS.md 4.2)
CHAR_NGRAM_RANGE = (2, 5)
WORD_NGRAM_RANGE = (1, 2)
# Tek bir ornekte gecen karakter parcasi gurultudur (harf hatasi); en az iki ornekte gorulmeli
CHAR_MIN_DF = 2
# Sablon bazli 5 parca: bir parca (~%20 sablon) test, gerisi egitim
SPLIT_FOLDS = 5
# Kalibrasyon icin ic capraz dogrulama parca sayisi
CALIBRATION_FOLDS = 3
# Yakinsama icin yeterli; varsayilan 100 cok sinifli TF-IDF'te uyari verir
MAX_ITERATIONS = 2000
LATENCY_PERCENTILES = (50, 95)
# Raporlarda 4 ondalik yeterli (0.0001 = binde bir puanin onda biri)
METRIC_DIGITS = 4
MS_PER_SECOND = 1000


def build_pipeline(*, seed: int) -> Pipeline:
    features = FeatureUnion(
        [
            (
                "char",
                TfidfVectorizer(
                    preprocessor=normalize,
                    analyzer="char_wb",
                    ngram_range=CHAR_NGRAM_RANGE,
                    min_df=CHAR_MIN_DF,
                    sublinear_tf=True,
                ),
            ),
            (
                "word",
                TfidfVectorizer(
                    preprocessor=normalize,
                    analyzer="word",
                    ngram_range=WORD_NGRAM_RANGE,
                    sublinear_tf=True,
                ),
            ),
        ]
    )
    classifier = LogisticRegression(
        class_weight="balanced", max_iter=MAX_ITERATIONS, random_state=seed
    )
    model = CalibratedClassifierCV(classifier, cv=CALIBRATION_FOLDS, method="sigmoid")
    return Pipeline([("features", features), ("model", model)])


def _template_folds(samples: Sequence[Sample], seed: int) -> Iterator[tuple[list[int], list[int]]]:
    """Her turden sablonlar 5 parcaya bolunur; bir sablonun butun ornekleri ayni parcadadir."""
    folds = StratifiedGroupKFold(n_splits=SPLIT_FOLDS, shuffle=True, random_state=seed)
    labels = [s.label for s in samples]
    groups = [s.template_id for s in samples]
    for train_index, test_index in folds.split(samples, labels, groups):
        yield list(train_index), list(test_index)


def split_by_template(samples: Sequence[Sample], *, seed: int) -> tuple[list[Sample], list[Sample]]:
    """Her turden sablonlarin bir kismi tamamen teste ayrilir; model test sablonunu hic gormez."""
    train_index, test_index = next(_template_folds(samples, seed))
    return [samples[i] for i in train_index], [samples[i] for i in test_index]


def latency_ms(pipeline: Pipeline, texts: Sequence[str]) -> dict[str, float]:
    """Tek bildirim tahmin suresi (uygulamada bildirimler tek tek gelir)."""
    durations = []
    for text in texts:
        started = time.perf_counter()
        pipeline.predict_proba([text])
        durations.append((time.perf_counter() - started) * MS_PER_SECOND)
    p50, p95 = np.percentile(durations, LATENCY_PERCENTILES)
    return {"p50": round(float(p50), 3), "p95": round(float(p95), 3)}


def _rounded(value: float) -> float:
    return round(float(value), METRIC_DIGITS)


def prediction_report(labels: Sequence[str], predicted: Sequence[str]) -> dict[str, Any]:
    """Tez metrikleri: accuracy, macro-F1, sinif bazli precision/recall/F1, karisiklik matrisi."""
    classes = sorted(set(labels) | set(predicted))
    precision, recall, f1, support = precision_recall_fscore_support(
        labels, predicted, labels=classes, zero_division=0
    )
    per_class = {
        code: {
            "precision": _rounded(p),
            "recall": _rounded(r),
            "f1": _rounded(f),
            "support": int(n),
        }
        for code, p, r, f, n in zip(classes, precision, recall, f1, support, strict=True)
    }
    return {
        "n": len(labels),
        "accuracy": _rounded(accuracy_score(labels, predicted)),
        "macro_f1": _rounded(
            f1_score(labels, predicted, labels=classes, average="macro", zero_division=0)
        ),
        "per_class": per_class,
        "confusion_matrix": {
            "labels": classes,
            "matrix": confusion_matrix(labels, predicted, labels=classes).tolist(),
        },
    }


def evaluate(pipeline: Pipeline, texts: Sequence[str], labels: Sequence[str]) -> dict[str, Any]:
    report = prediction_report(labels, list(pipeline.predict(list(texts))))
    return {**report, "latency_ms": latency_ms(pipeline, texts)}


def cross_validate(samples: Sequence[Sample], *, seed: int) -> dict[str, Any]:
    """Sablon bazli 5 katli capraz dogrulama: her ornek, sablonunu hic gormemis modelle test edilir.

    Tek bir test parcasi her turden ~2 sablon icerir ve sonuc sansa cok bagli olur; burada butun
    parcalarin tahminleri birlestirilir, parca bazli ortalama ve sapma da raporlanir.
    """
    labels: list[str] = []
    predicted: list[str] = []
    folds = []
    for train_index, test_index in _template_folds(samples, seed):
        model = build_pipeline(seed=seed)
        model.fit([samples[i].text for i in train_index], [samples[i].label for i in train_index])
        fold_labels = [samples[i].label for i in test_index]
        fold_predicted = list(model.predict([samples[i].text for i in test_index]))
        folds.append(_fold_scores(fold_labels, fold_predicted))
        labels += fold_labels
        predicted += fold_predicted
    report = prediction_report(labels, predicted)
    return {
        **report,
        "folds": folds,
        "accuracy_std": _rounded(np.std([f["accuracy"] for f in folds])),
        "macro_f1_std": _rounded(np.std([f["macro_f1"] for f in folds])),
    }


def _fold_scores(labels: Sequence[str], predicted: Sequence[str]) -> dict[str, Any]:
    return {
        "n": len(labels),
        "accuracy": _rounded(accuracy_score(labels, predicted)),
        "macro_f1": _rounded(f1_score(labels, predicted, average="macro", zero_division=0)),
    }
