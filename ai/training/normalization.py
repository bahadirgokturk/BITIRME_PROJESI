"""Egitim ve calisma ani AYNI normalize()'i kullanir (docs/AGENTS.md bolum 2).

Kopya tutulmaz: backend'deki fonksiyon dogrudan yuklenir (ai/ ile backend/ ayni repoda yan yana).
Model bu fonksiyonu adiyla (app.agents.text.normalize) saklar; backend modeli yukleyince ayni kodu calistirir.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from app.agents.text import normalize  # noqa: E402

__all__ = ["normalize"]
