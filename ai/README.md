# ai/ — Model eğitimi ve sentetik veri

Backend'den bağımsız Python projesi (`uv`, Python 3.12). Ayrıntılar: [docs/AGENTS.md](../docs/AGENTS.md) bölüm 6.

| Klasör | İçerik |
|---|---|
| `generators/` | Sentetik Türkçe bildirim üretici: `templates/campus.yaml` (case type başına şablon cümleler) × lokasyonlar (backend kampüs seed'inden) × gürültü (günlük ifade, küçük harf, harf hatası) |
| `training/` | `classifier.py` (model + ölçüm), `train_classifier.py` (eğit), `evaluate_model.py` (etiketli gerçek veriyle ölç) |
| `data/` | `raw/` (gitignore, ham form verisi), `synthetic/` (yeniden üretilir, gitignore), `labeled/` (anonim, etiketli) |
| `models/` | `classifier/v1/metrics.json` repoda; `model.joblib` komutla yeniden üretilir (gitignore) |
| `notebooks/` | EDA ve akademik raporlama |

```bash
cd ai
uv sync
uv run pytest
uv run python -m training.train_classifier --out models/classifier/v1     # veri üret + eğit + ölç
uv run python -m training.evaluate_model --model models/classifier/v1/model.joblib --data data/labeled/real.csv
```

## Önemli kurallar
- **Aynı normalizasyon:** Model metni backend'deki `app.agents.text.normalize()` ile işler
  (`training/normalization.py` onu doğrudan yükler, kopyası yoktur). Normalizasyon değişirse model yeniden eğitilir.
- **Dürüst ölçüm:** `metrics.json` içindeki sonuç **sentetik** veride, eğitimde hiç görülmemiş şablonlarla ölçülür
  (`synthetic-template-holdout`). Tezdeki asıl başarı Google Form'dan gelen, ekipçe etiketlenmiş gerçek veriyle
  `evaluate_model.py` ile ölçülür.
- **Tekrarlanabilirlik:** Üretim ve eğitim tohumla (`--seed`, varsayılan 42) aynı sonucu verir.
- **Etiketli CSV biçimi:** `text,label` (label = case type kodu, [DEPARTMENTS.md](../docs/DEPARTMENTS.md)).
