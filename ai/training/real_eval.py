"""Gercek veriyle olcum (RQ1, test plani adim 4-5).

- Model: egitilmis TF-IDF + Logistic Regression.
- Temel yontem (baseline): backend'in model yokken kullandigi kural; ayni anahtar kelimeler (kampus
  seed'i) ve ayni normalize() ile en cok eslesen tur, hic yoksa OTHER.
- Yonlendirme (RQ2): tahmin edilen turun birimi, gercek turun birimiyle ayni mi. Birim seed'deki
  `primary` alanidir (docs/DEPARTMENTS.md); bos ise bildirim insana gider, birime gitmez.
- Guven esigi analizi: esik degistikce otomatik giden pay ve onlarin dogrulugu. Sistemde esik 0.70
  (MIN_CONFIDENCE_AUTO_DEFAULT); bu tablo esigin neden orada oldugunu gosterir.
"""

from collections.abc import Sequence
from pathlib import Path
from typing import Any, Protocol

import numpy as np
import yaml

from training.classifier import prediction_report
from training.normalization import normalize

SEED_CASE_TYPES = (
    Path(__file__).resolve().parents[2] / "backend/seeds/templates/campus/case_types.yaml"
)
# Hicbir anahtar kelime eslesmezse (backend FALLBACK_CODE)
FALLBACK_CODE = "OTHER"
# 0.50'den 0.95'e 0.05 adimla; sistemdeki esik (0.70) aralikta
DEFAULT_THRESHOLDS = [round(0.5 + 0.05 * step, 2) for step in range(10)]
SHARE_DIGITS = 4
# Birimi olmayan turler (kapsam disi, diger) icin tablo anahtari
NO_UNIT = "-"


class Classifier(Protocol):
    classes_: Any

    def predict(self, texts: Sequence[str]) -> Any: ...

    def predict_proba(self, texts: Sequence[str]) -> Any: ...


class KeywordBaseline:
    """backend app/agents/classification.py _rule_candidates ile ayni karar."""

    def __init__(self, case_types: Sequence[dict[str, Any]]) -> None:
        self._keywords = {
            entry["code"]: [normalize(keyword) for keyword in entry.get("keywords") or []]
            for entry in case_types
        }

    @classmethod
    def from_seed(cls, path: Path = SEED_CASE_TYPES) -> "KeywordBaseline":
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return cls(data["case_types"])

    def _choose(self, text: str) -> str:
        # Kelime basindan eslesme: "sabunluk" -> "sabunlukta" da sayilir (Turkce ekler)
        padded = f" {normalize(text)}"
        scores = {
            code: sum(f" {keyword}" in padded for keyword in keywords)
            for code, keywords in self._keywords.items()
        }
        best = max(scores, key=lambda code: scores[code])
        return best if scores[best] else FALLBACK_CODE

    def predict(self, texts: Sequence[str]) -> list[str]:
        return [self._choose(text) for text in texts]


def threshold_table(
    confidences: Sequence[float], correct: Sequence[bool], thresholds: Sequence[float]
) -> list[dict[str, Any]]:
    total = len(confidences)
    rows = []
    for threshold in thresholds:
        auto = [
            ok
            for confidence, ok in zip(confidences, correct, strict=True)
            if confidence >= threshold
        ]
        rows.append(
            {
                "threshold": threshold,
                "auto_share": round(len(auto) / total, SHARE_DIGITS),
                "auto_accuracy": round(sum(auto) / len(auto), SHARE_DIGITS) if auto else None,
                "review_share": round(1 - len(auto) / total, SHARE_DIGITS),
            }
        )
    return rows


def evaluate_real(
    model: Classifier,
    baseline: KeywordBaseline,
    texts: Sequence[str],
    labels: Sequence[str],
) -> dict[str, Any]:
    if not texts:
        raise ValueError("Test seti bos: once etiketli satir gerekli")
    probabilities = np.asarray(model.predict_proba(list(texts)))
    predicted = [str(code) for code in model.classes_[probabilities.argmax(axis=1)]]
    model_report = prediction_report(labels, predicted)
    baseline_report = prediction_report(labels, baseline.predict(texts))
    correct = [guess == truth for guess, truth in zip(predicted, labels, strict=True)]
    return {
        "n": len(texts),
        "model": model_report,
        "baseline": baseline_report,
        "difference": {
            metric: round(model_report[metric] - baseline_report[metric], SHARE_DIGITS)
            for metric in ("accuracy", "macro_f1")
        },
        "thresholds": threshold_table(
            probabilities.max(axis=1).tolist(), correct, DEFAULT_THRESHOLDS
        ),
    }


def compare_models(
    models: dict[str, Classifier],
    baseline: KeywordBaseline,
    texts: Sequence[str],
    labels: Sequence[str],
) -> dict[str, Any]:
    """Ogrenen model: surumler (v1, v2...) ayni gercek cumlelerle, temel yontemle birlikte."""
    if not texts:
        raise ValueError("Test seti bos: once etiketli satir gerekli")
    return {
        "n": len(texts),
        "baseline": prediction_report(labels, baseline.predict(texts)),
        "models": {
            name: prediction_report(labels, [str(code) for code in model.predict(list(texts))])
            for name, model in models.items()
        },
    }


def primary_departments(path: Path = SEED_CASE_TYPES) -> dict[str, str | None]:
    """Tur kodu -> gorevi alan birim (seed `primary`; bos = insan inceler)."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return {entry["code"]: entry.get("primary") for entry in data["case_types"]}


def routing_report(
    truths: Sequence[str], predicted: Sequence[str], routes: dict[str, str | None]
) -> dict[str, Any]:
    """RQ2: tahmin edilen turun birimi beklenen birimle ayni mi (birim duzeyinde dogruluk)."""
    if not truths:
        raise ValueError("Test seti bos: once etiketli satir gerekli")
    pairs = [(routes[truth], routes[guess]) for truth, guess in zip(truths, predicted, strict=True)]
    per_department: dict[str, dict[str, Any]] = {}
    for expected, got in pairs:
        row = per_department.setdefault(expected or NO_UNIT, {"n": 0, "correct": 0})
        row["n"] += 1
        row["correct"] += expected == got
    for row in per_department.values():
        row["accuracy"] = round(row["correct"] / row["n"], SHARE_DIGITS)
    return {
        "n": len(pairs),
        "accuracy": round(sum(e == g for e, g in pairs) / len(pairs), SHARE_DIGITS),
        # Baska birime gitti
        "wrong_unit": sum(bool(e and g and e != g) for e, g in pairs),
        # Birimi vardi ama bildirim birimsiz (insan incelemesine) kaldi
        "no_unit": sum(bool(e and not g) for e, g in pairs),
        # Birimi olmayan bildirim bir birime gonderildi
        "unneeded_unit": sum(bool(g and not e) for e, g in pairs),
        "per_department": dict(sorted(per_department.items())),
    }
