# ai/ — Model eğitimi ve sentetik veri

Backend'den bağımsız Python projesi (`uv`). Ayrıntılar: [docs/AGENTS.md](../docs/AGENTS.md).

| Klasör | İçerik |
|---|---|
| `generators/` | Sentetik Türkçe bildirim üretici; `templates/campus.yaml` case type başına şablon cümleler |
| `training/` | `train_classifier.py`, `evaluate.py` (FAZ 5) |
| `data/` | `raw/` (gitignore, gerçek form verisi), `synthetic/`, `labeled/` (anonim) |
| `models/` | Eğitilmiş `.joblib` + `metrics.json` (versiyonlu) |
| `notebooks/` | EDA ve akademik raporlama |

```bash
cd ai
uv sync
uv run pytest
```
