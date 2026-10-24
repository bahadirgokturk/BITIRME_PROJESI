"""Gercek veriyle olcum (RQ1): model, kural tabanli temel yontem ve guven esigi analizi."""

from collections.abc import Sequence

import numpy as np
import pytest

from training.real_eval import KeywordBaseline, evaluate_real, threshold_table

SEED_TYPES = [
    {"code": "SOAP_EMPTY", "keywords": ["sabun", "sabunluk"]},
    {"code": "WIFI_FAILURE", "keywords": ["internet", "wifi", "kablosuz"]},
    {"code": "OTHER", "keywords": []},
]


class FakeModel:
    """sklearn benzeri: her metin icin olasiliklar testte verilir."""

    classes_ = np.array(["OTHER", "SOAP_EMPTY", "WIFI_FAILURE"])

    def __init__(self, table: dict[str, list[float]]) -> None:
        self._table = table

    def predict_proba(self, texts: Sequence[str]) -> np.ndarray:
        return np.array([self._table[text] for text in texts])

    def predict(self, texts: Sequence[str]) -> np.ndarray:
        return self.classes_[self.predict_proba(texts).argmax(axis=1)]


def test_keyword_baseline_mirrors_the_backend_fallback() -> None:
    baseline = KeywordBaseline(SEED_TYPES)

    # Turkce ek: "sabunlukta" -> sabunluk; buyuk harf ve i/I farki normalize ile gider
    assert baseline.predict(["Lavabodaki SABUNLUKTA hiç sabun yok"]) == ["SOAP_EMPTY"]
    assert baseline.predict(["Kütüphanede İNTERNET çekmiyor"]) == ["WIFI_FAILURE"]
    # Hicbir kelime yoksa insan incelemesine giden tur
    assert baseline.predict(["Merdivenin korkuluğu sallanıyor"]) == ["OTHER"]


def test_report_compares_the_model_with_the_baseline() -> None:
    texts = ["sabun bitmiş", "wifi yok", "lavabo boş kalmış"]
    labels = ["SOAP_EMPTY", "WIFI_FAILURE", "SOAP_EMPTY"]
    model = FakeModel(
        {
            "sabun bitmiş": [0.1, 0.8, 0.1],
            "wifi yok": [0.1, 0.1, 0.8],
            # Anahtar kelime yok ama model bilir: baseline'in kacirdigi ornek
            "lavabo boş kalmış": [0.2, 0.7, 0.1],
        }
    )

    report = evaluate_real(model, KeywordBaseline(SEED_TYPES), texts, labels)

    assert report["n"] == 3
    assert report["model"]["accuracy"] == pytest.approx(1.0)
    assert report["baseline"]["accuracy"] == pytest.approx(2 / 3, abs=1e-4)
    assert report["difference"]["accuracy"] == pytest.approx(1 / 3, abs=1e-4)
    assert report["model"]["confusion_matrix"]["labels"] == ["SOAP_EMPTY", "WIFI_FAILURE"]


def test_threshold_table_shows_what_goes_automatic_and_how_right_it_is() -> None:
    confidences = [0.95, 0.9, 0.6, 0.4]
    correct = [True, True, False, True]

    table = threshold_table(confidences, correct, thresholds=[0.5, 0.8])

    low, high = table
    assert (low["threshold"], low["auto_share"], low["auto_accuracy"]) == (0.5, 0.75, 0.6667)
    assert (high["threshold"], high["auto_share"], high["auto_accuracy"]) == (0.8, 0.5, 1.0)
    # Mudure giden kisim: esigin altindakiler
    assert high["review_share"] == 0.5


def test_threshold_with_nothing_above_has_no_accuracy() -> None:
    (row,) = threshold_table([0.3], [True], thresholds=[0.9])

    assert (row["auto_share"], row["auto_accuracy"]) == (0.0, None)


def test_empty_test_set_is_refused() -> None:
    with pytest.raises(ValueError, match="etiketli"):
        evaluate_real(FakeModel({}), KeywordBaseline(SEED_TYPES), [], [])
