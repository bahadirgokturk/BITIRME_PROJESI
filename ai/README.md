# ai/ — Model eğitimi ve sentetik veri

Backend'den bağımsız Python projesi (`uv`, Python 3.12). Ayrıntılar: [docs/AGENTS.md](../docs/AGENTS.md) bölüm 6.

| Klasör | İçerik |
|---|---|
| `generators/` | Sentetik Türkçe bildirim üretici: `templates/campus.yaml` (case type başına şablon cümleler) × lokasyonlar (backend kampüs seed'inden) × gürültü (günlük ifade, küçük harf, harf hatası) |
| `training/` | `classifier.py` (model + ölçüm), `train_classifier.py` (eğit), `evaluate_model.py` (etiketli CSV ile ölç), `real_data.py` (Google Form → etiketleme tablosu → kappa → RQ1 raporu) |
| `data/` | `raw/` (gitignore: form verisi, etiketleme tablosu, RQ1 sonuçları), `synthetic/` (yeniden üretilir, gitignore), `labeled/` (CSV'ler gitignore) |
| `models/` | `classifier/v1/metrics.json` ve `report.html` (grafikli eğitim raporu, tarayıcıda açılır) repoda; `model.joblib` yeniden üretilir (gitignore). Backend'in kullandığı kopya: `backend/ml_models/classifier/v1/` |
| `notebooks/` | EDA ve akademik raporlama |

```bash
cd ai
uv sync
uv run pytest
uv run python -m training.train_classifier --out models/classifier/v1     # veri üret + eğit + ölç + report.html
uv run python -m training.train_classifier --publish ../backend/ml_models/classifier/v1   # backend'e de kopyala
uv run python -m training.evaluate_model --model models/classifier/v1/model.joblib --data data/labeled/real.csv
```

## Gerçek veriyle ölçüm (RQ1)

Google Form cevaplarından tez tablosuna üç adım. Gerçek cümleler **açık repoya konmaz** (KVKK, form metni):
hepsi `data/raw/` altında kalır, repoya yalnız sayısal sonuç (`rq1.md`) eklenebilir.

1. Formda **Yanıtlar → ⋮ → Yanıtları indir (.csv)**, dosyayı `data/raw/form.csv` olarak kaydet.
2. Etiketleme tablosu (her sorun cümlesi bir satır; kısa/boş ve dikkat sorusunu yanlış yanıtlayanlar atlanır;
   e-posta, telefon, uzun numaralar maskelenir):
   ```bash
   uv run python -m training.real_data prepare --form data/raw/form.csv --out data/raw/etiket.csv
   ```
3. `etiket.csv`'yi Excel'de aç. İki kişi birbirinin cevabını görmeden `label_a` ve `label_b` sütunlarına
   tür kodunu yazar (`SOAP_EMPTY`… [DEPARTMENTS.md](../docs/DEPARTMENTS.md)). `respondent_topic` katılımcının
   seçimidir, doğru cevap değildir.
4. Anlaşma ve çözülecek satırlar (anlaşmazlıklar birlikte konuşulup `label_final`'a yazılır):
   ```bash
   uv run python -m training.real_data agreement --sheet data/raw/etiket.csv
   ```
5. Ölçüm: model ile anahtar kelime yöntemi (backend'in model yokken kullandığı kural) yan yana, güven eşiği
   tablosuyla. `data/raw/rq1/rq1.md` tezdeki tablodur, `rq1.json` sınıf bazlı sonuçlar ve karışıklık matrisi:
   ```bash
   uv run python -m training.real_data evaluate --sheet data/raw/etiket.csv --model models/classifier/v1/model.joblib --out data/raw/rq1
   ```

## Öğrenen model (v2)

Müdürün "bu aslında X türü" düzeltmeleri (`decision_feedback`) yeni modelin eğitimine eklenir; v1 ve v2
aynı gerçek test setinde karşılaştırılır. Bir düzeltme insan doğrulamalı gerçek örnek olduğu için 5 sentetik
örnek ağırlığındadır; test setindeki cümleler (büyük/küçük harf farkı dahil) eğitime girmez.

```bash
# repo kökünden: düzeltmeleri dışa aktar (her bildirimin son tür düzeltmesi)
docker compose exec -T backend python -m scripts.export_feedback > ai/data/raw/feedback.csv
# ai/ içinde: v2'yi eğit (test tablosundaki cümleler dışarıda kalır)
uv run python -m training.train_classifier --version 2.0 --out models/classifier/v2 --feedback data/raw/feedback.csv --holdout data/raw/etiket.csv
# aynı test setinde v1, v2 ve anahtar kelime yöntemi
uv run python -m training.real_data compare --sheet data/raw/etiket.csv --out data/raw/rq1 --model v1=models/classifier/v1/model.joblib --model v2=models/classifier/v2/model.joblib
```

`metrics.json` içinde `version`, `feedback_samples` ve ölçüm verisi `synthetic-template-cv+feedback` olarak yazılır.
Backend şu an `ml_models/classifier/v1` klasörünü yükler (`app/agents/model_store.py` `CLASSIFIER_DIR`); v2 gerçek
veride v1'den iyi çıkarsa o klasöre yayınlanır (`--publish ../backend/ml_models/classifier/v1`, `metrics.json` sürümü 2.0 yazar).

## Önemli kurallar
- **Aynı normalizasyon:** Model metni backend'deki `app.agents.text.normalize()` ile işler
  (`training/normalization.py` onu doğrudan yükler, kopyası yoktur). Normalizasyon değişirse model yeniden eğitilir.
- **Dürüst ölçüm:** `metrics.json` içindeki sonuç **sentetik** veride, eğitimde hiç görülmemiş şablonlarla ölçülür
  (`synthetic-template-holdout`). Tezdeki asıl başarı Google Form'dan gelen, ekipçe etiketlenmiş gerçek veriyle
  `evaluate_model.py` ile ölçülür.
- **Tekrarlanabilirlik:** Üretim ve eğitim tohumla (`--seed`, varsayılan 42) aynı sonucu verir.
- **Etiketli CSV biçimi:** `text,label` (label = case type kodu, [DEPARTMENTS.md](../docs/DEPARTMENTS.md)).
