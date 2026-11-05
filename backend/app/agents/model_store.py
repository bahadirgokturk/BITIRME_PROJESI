"""Egitilmis modellerin yuklenmesi (docs/AGENTS.md bolum 6).

Model ai/ projesinde egitilir ve `--publish` ile backend/ml_models/ altina kopyalanir. Yuklenemezse
(dosya yok ya da scikit-learn surumu farkli) None doner: Classification Agent kural tabanina duser.
Farkli surumle kaydedilmis pickle hata vermeden yanlis sonuc uretebilir; bu yuzden hic yuklenmez.
"""

import json
import logging
from functools import lru_cache
from pathlib import Path

import joblib
import sklearn

from app.agents.classification import LoadedClassifier

CLASSIFIER_DIR = Path(__file__).resolve().parents[2] / "ml_models" / "classifier" / "v1"
MODEL_FILE = "model.joblib"
METRICS_FILE = "metrics.json"

logger = logging.getLogger(__name__)


def load_classifier(directory: Path) -> LoadedClassifier | None:
    model_path, metrics_path = directory / MODEL_FILE, directory / METRICS_FILE
    if not model_path.exists() or not metrics_path.exists():
        logger.warning("Siniflandirma modeli yok (%s); kural tabanli siniflandirma", directory)
        return None
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    if metrics["sklearn_version"] != sklearn.__version__:
        logger.warning(
            "Model scikit-learn %s ile egitilmis, kurulu surum %s; kural tabanli siniflandirma",
            metrics["sklearn_version"],
            sklearn.__version__,
        )
        return None
    # Yalniz repodaki kendi modelimiz yuklenir (pickle disaridan alinmaz)
    pipeline = joblib.load(model_path)
    return LoadedClassifier(pipeline=pipeline, version=str(metrics["version"]))


@lru_cache(maxsize=1)
def get_classifier() -> LoadedClassifier | None:
    """Uygulama boyunca tek kopya: model bir kez yuklenir (~4 MB, birkac yuz ms)."""
    return load_classifier(CLASSIFIER_DIR)
