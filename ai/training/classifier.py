"""Classification modeli v1 (E5-3, docs/AGENTS.md 4.2): TF-IDF (karakter + kelime) + Logistic Regression.

Karakter n-gram Turkce eklere ("sabunluk", "sabunu") lemmatizer olmadan dayanir; kalibrasyon guven
skorunu Supervisor esiginde kullanilabilir yapar. Metin once backend'in normalize()'inden gecer.
"""

import time
from collections.abc import Sequence
from typing import Any

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_recall_fscore_support
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
                    preprocessor=normalize, analyzer="word", ngram_range=WORD_NGRAM_RANGE, sublinear_tf=True
                ),
            ),
        ]
    )
    classifier = LogisticRegression(class_weight="balanced", max_iter=MAX_ITERATIONS, random_state=seed)
    model = CalibratedClassifierCV(classifier, cv=CALIBRATION_FOLDS, method="sigmoid")
    return Pipeline([("features", features), ("model", model)])


def split_by_template(samples: Sequence[Sample], *, seed: int) -> tuple[list[Sample], list[Sample]]:
    """Her turden sablonlarin bir kismi tamamen teste ayrilir: model test cumlesinin sablonunu hic gormez."""
    folds = StratifiedGroupKFold(n_splits=SPLIT_FOLDS, shuffle=True, random_state=seed)
    labels = [s.label for s in samples]
    groups = [s.template_id for s in samples]
    train_index, test_index = next(folds.split(samples, labels, groups))
    return [samples[i] for i in train_index], [samples[i] for i in test_index]


def _latency_ms(pipeline: Pipeline, texts: Sequence[str]) -> dict[str, float]:
    """Tek bildirim tahmin suresi (uygulamada bildirimler tek tek gelir)."""
    durations = []
    for text in texts:
        started = time.perf_counter()
        pipeline.predict_proba([text])
        durations.append((time.perf_counter() - started) * MS_PER_SECOND)
    p50, p95 = np.percentile(durations, LATENCY_PERCENTILES)
    return {"p50": round(float(p50), 3), "p95": round(float(p95), 3)}


def evaluate(pipeline: Pipeline, texts: Sequence[str], labels: Sequence[str]) -> dict[str, Any]:
    predicted = pipeline.predict(list(texts))
    classes = sorted(set(labels) | set(pipeline.classes_))
    precision, recall, f1, support = precision_recall_fscore_support(
        labels, predicted, labels=classes, zero_division=0
    )
    per_class = {
        code: {
            "precision": round(float(p), 4),
            "recall": round(float(r), 4),
            "f1": round(float(f), 4),
            "support": int(n),
        }
        for code, p, r, f, n in zip(classes, precision, recall, f1, support, strict=True)
    }
    return {
        "n": len(labels),
        "accuracy": round(float(accuracy_score(labels, predicted)), 4),
        "macro_f1": round(float(f1_score(labels, predicted, labels=classes, average="macro", zero_division=0)), 4),
        "per_class": per_class,
        "confusion_matrix": {
            "labels": classes,
            "matrix": confusion_matrix(labels, predicted, labels=classes).tolist(),
        },
        "latency_ms": _latency_ms(pipeline, texts),
    }
