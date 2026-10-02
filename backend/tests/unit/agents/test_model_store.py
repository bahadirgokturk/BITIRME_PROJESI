"""Egitilmis modelin yuklenmesi: repodaki model, eksik dosya, surum uyusmazligi."""

import json
import shutil
from pathlib import Path

from app.agents.model_store import CLASSIFIER_DIR, load_classifier


def test_shipped_model_loads_and_reads_everyday_text() -> None:
    loaded = load_classifier(CLASSIFIER_DIR)

    assert loaded is not None
    assert loaded.version == "1.0"
    assert len(loaded.pipeline.classes_) == 19
    # Model metni backend'in normalize()'i ile isler (egitimle ayni)
    predicted = loaded.pipeline.predict(["TUVALETTE SABUN KALMAMIŞ", "eduroam bağlanmıyor"])
    assert list(predicted) == ["SOAP_EMPTY", "WIFI_FAILURE"]


def test_missing_model_means_rules_only(tmp_path: Path) -> None:
    assert load_classifier(tmp_path / "yok") is None


def test_model_from_another_sklearn_version_is_not_loaded(tmp_path: Path) -> None:
    # Farkli surumle pickle edilmis model sessizce yanlis sonuc verebilir: hic yuklenmez
    for name in ("model.joblib", "metrics.json"):
        shutil.copyfile(CLASSIFIER_DIR / name, tmp_path / name)
    metrics = json.loads((tmp_path / "metrics.json").read_text(encoding="utf-8"))
    metrics["sklearn_version"] = "0.0.1"
    (tmp_path / "metrics.json").write_text(json.dumps(metrics), encoding="utf-8")

    assert load_classifier(tmp_path) is None
