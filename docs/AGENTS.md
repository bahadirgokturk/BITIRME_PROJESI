# AGENTS — Ücretsiz, Yerel ve Açıklanabilir Agent Mimarisi

## 1. Temel Karar: Ücretli API Yok

Agent'lar **hiçbir ücretli LLM API'sine bağımlı değildir** (OpenAI/Claude/Gemini API yok). Üç katmanlı
yerel bir "zekâ yığını" kullanılır:

| Katman | Teknoloji | Maliyet | Nerede kullanılır | Her zaman açık mı? |
|---|---|---|---|---|
| **K1 – Kural motoru** | Python, regex, Türkçe sözlükler, ağırlıklı puanlama | 0 | Intake, Priority, Verification, Routing, Supervisor, Monitoring, Resolution | ✅ Evet (fallback) |
| **K2 – Kendi eğittiğimiz ML** | scikit-learn: TF-IDF (karakter n-gram) + Logistic Regression; opsiyonel çok dilli embedding (`paraphrase-multilingual-MiniLM-L12-v2`, CPU'da çalışır) | 0 | Classification, Duplicate | ✅ Evet (model dosyası repoda/artefakt olarak) |
| **K3 – Yerel LLM (opsiyonel)** | Ollama + küçük açık model (ör. `qwen2.5:3b`, `llama3.2:3b`) | 0 (kendi bilgisayarımızda) | Analytics özetinin dilini güzelleştirme, Intake'te belirsiz metinden varlık çıkarımı | ❌ Kapalı olabilir; sistem K1/K2 ile tam çalışır |

`.env`: `AI_MODE=rules|ml|ml_llm` (varsayılan `ml`), `LLM_PROVIDER=none|ollama`, `OLLAMA_URL`.

### Neden bu yaklaşım akademik olarak daha güçlü?

1. **Ölçülebilirlik:** Kendi modelimizi eğittiğimiz için train/test ayrımı, confusion matrix, macro-F1
   raporlayabiliriz (RQ1). Hazır API'de "neden doğru/yanlış?" sorusunun cevabı yok.
2. **Açıklanabilirlik:** Logistic Regression'da her kararı en çok etkileyen n-gram'lar gösterilebilir;
   Priority'de her sinyalin puana katkısı tablo olarak verilir.
3. **Determinizm & test:** Aynı girdi → aynı çıktı. pytest ile doğrulanabilir.
4. **Sürdürülebilirlik:** İnternet/API kesintisinde sistem çökmez; KVKK açısından veri kampüs dışına çıkmaz.
5. **İnsan-AI döngüsü:** Manager düzeltmeleri (`decision_feedback`) yeni etiketli veri olur → model
   yeniden eğitilir → versiyon karşılaştırması yapılır (öğrenen organizasyon, YBS boyutu).

> **Savunma notu:** "LLM kullanmıyorsanız bu agent mı?" — Evet. Russell & Norvig tanımıyla agent;
> ortamı algılayan (structured input), bir politika/model ile karar veren ve eylem öneren sistemdir.
> Sistemimizde her agent algı → karar → gerekçe → eylem önerisi döngüsüne sahiptir; orchestrator ve
> autonomy policy ile çok-agent'lı bir karar destek mimarisi oluşur.

## 2. Ortak Agent Sözleşmesi

```python
class AgentResult(BaseModel, Generic[TOut]):
    agent_name: str
    decision: str                 # kısa karar kodu
    confidence: float | None      # 0..1
    reasons: list[Reason]         # [{code, message_tr, weight, evidence}]
    output: TOut                  # agent'a özgü Pydantic çıktı
    model: str                    # "rules@1.0", "tfidf-logreg@2026.10.1"
    latency_ms: int

class BaseAgent(Protocol[TIn, TOut]):
    name: ClassVar[str]
    version: ClassVar[str]
    def run(self, inp: TIn, ctx: AgentContext) -> AgentResult[TOut]: ...
```

- `AgentContext`: sadece okunur veriler (case type sözlüğü, lokasyon listesi, aday benzer case'ler,
  aktif policy'ler, şimdiki zaman). Agent **DB'ye erişmez**; context'i servis katmanı hazırlar.
- Her agent çıktısı `agent_decisions` tablosuna `input_snapshot` ile birlikte yazılır → karar tekrar üretilebilir.
- Provider arayüzleri (`agents/providers/`): `TextClassifier`, `Embedder`, `LLMClient` Protocol'leri.
  Model yüklenemezse otomatik olarak bir alt katmana düşülür (ML → kural) ve `reasons` içine
  `FALLBACK_USED` eklenir.

## 3. Pipeline (Orchestrator)

```mermaid
flowchart TD
    A[Case NEW] --> I[Intake<br/>normalize + ipucu çıkarımı]
    I --> C[Classification<br/>case type + kategori]
    I --> D[Duplicate<br/>benzer açık case'ler]
    C --> V[Verification<br/>güven skoru]
    D --> V
    C --> P[Priority<br/>0-100 impact]
    D --> P
    V --> P
    C --> R[Routing<br/>departman + personel]
    P --> S{Supervisor<br/>politika tablosu}
    R --> S
    V --> S
    D --> S
    S -->|AUTO_ASSIGN / CREATE_TASK| T[Task + SLA due_at]
    S -->|MERGE_WITH_EXISTING_CASE| M[MERGED]
    S -->|REQUEST_MORE_INFO| N[NEEDS_INFO]
    S -->|SEND_TO_HUMAN_REVIEW| H[CLASSIFIED + review kuyruğu]
    S -->|ESCALATE| E[ESCALATED]
```

Orchestrator sıralı ve basittir (Python fonksiyonları). LangChain/LangGraph kullanılmaz.

## 4. Agent'lar

### 4.1 Intake Agent (K1, opsiyonel K3)
- **Girdi:** title, description, seçilen location_id, fotoğraf var mı
- **İşlem:** Türkçe normalizasyon (`İ/ı` doğru lowercase, ASCII-katlama: "sabun yok" = "sabun yok",
  "tuvalet"≈"wc"≈"lavabo" eşanlam sözlüğü), yazım hatası toleransı (`rapidfuzz`),
  regex ile lokasyon ipuçları (`B blok`, `2. kat`, `Z-12`, `erkek/kadın wc`),
  aciliyet sözlüğü (`acil, kıvılcım, duman, yanık kokusu, su basıyor, elektrik çarptı, yangın`).
- **Çıktı:** `normalized_text, problem_phrase, location_hints[], urgency_hints[], entities{}, location_consistency`
- Seçilen lokasyon ile metindeki lokasyon ipucu çelişiyorsa `location_consistency=false` (Verification sinyali).

### 4.2 Classification Agent (K2 + K1)
- **Model:** `TfidfVectorizer(analyzer="char_wb", ngram_range=(2,5))` ∪ kelime (1,2)-gram →
  `LogisticRegression(class_weight="balanced")` + `CalibratedClassifierCV` (güvenilir olasılık).
  Karakter n-gram, Türkçe eklemeli yapıya ("sabunluk", "sabunu", "sabunlar") lemmatizer olmadan dayanıklıdır.
- **Kural katmanı:** Güvenlik sözlüğü eşleşirse (kıvılcım, yangın…) model sonucu ne olursa olsun
  `ELECTRICAL_FAILURE`/`SECURITY` adayına yükseltilir ve gerekçeye `SAFETY_RULE` eklenir.
- **Çıktı:** `case_type_code, category, confidence, top_k[{code, prob}], explanation.top_features[]`
- **Karar eşiği:** `confidence < policy.min_confidence_auto` → human review.
- Model dosyası yoksa: anahtar kelime puanlaması (case_types.keywords) → `model="rules@1.0"`.

### 4.3 Duplicate Agent (K2 + K1)
1. **Aday üretimi (servis):** aynı organizasyon, terminal olmayan, son 24 saat, aynı bina (path prefix).
2. **Skor:** `dup = 0.45·text_sim + 0.25·type_match + 0.20·location_score + 0.10·time_decay`
   - `text_sim`: TF-IDF kosinüs (varsayılan) veya yerel embedding kosinüs (opsiyonel)
   - `location_score`: aynı alan 1.0, aynı kat 0.6, aynı bina 0.3
   - `time_decay = exp(-Δdakika / τ)`, τ case type'a göre (sabun: 120 dk, su kaçağı: 60 dk)
- **Eşikler (config):** ≥ 0.80 → `MERGE` önerisi; 0.60–0.80 → olası duplicate, human review; < 0.60 → yeni case.
- **Çıktı:** `duplicate_probability, possible_parent_case_id, similar_cases[{case_id, score, components}]`

### 4.4 Verification Agent (K1)
Ağırlıklı skor (0..1), her sinyal gerekçeye yazılır:

| Sinyal | Etki |
|---|---|
| Fotoğraf var | +0.20 |
| Duplicate/benzer bildirim sayısı (≥1 / ≥3) | +0.15 / +0.25 |
| Lokasyon tutarlı | +0.15, çelişkili −0.15 |
| Reporter geçmişi (reddedilen case oranı düşük) | +0.10 … −0.20 |
| Aynı lokasyon+tipte geçmişte doğrulanmış case | +0.10 |
| Metin çok kısa / anlamsız | −0.20 |

Başlangıç 0.40. `verification_level`: LOW (<0.4) / MEDIUM / HIGH (≥0.7).

### 4.5 Priority Agent (K1)
`impact_score = clamp(Σ sinyal katkıları, 0, 100)`:

| Sinyal | Katkı aralığı |
|---|---|
| case_type.base_severity | 0–40 |
| Güvenlik ilgisi (is_safety_related / güvenlik kelimesi) | +30 (ve min. 85'e taban) |
| Lokasyon önemi (importance_weight) | 0–15 |
| Duplicate bildirim sayısı | 0–10 |
| Zaman hassasiyeti (ders saati, sınav haftası) | 0–5 |
| Tekrarlama (son 30 gün aynı lokasyon+tip) | 0–10 |
| Aciliyet ifadeleri | 0–10 |

Bantlar: LOW 0–39 · MEDIUM 40–64 · HIGH 65–84 · CRITICAL 85–100.
UI'da her katkı bir bar olarak gösterilir ("neden HIGH?"). Örnek: sabun bitti → ~50 (MEDIUM),
"prizden kıvılcım çıkıyor" → ≥ 90 (CRITICAL).

### 4.6 Routing Agent (K1)
1. Departman: `case_types.default_department_id` (override: kategori bazlı kural).
2. Personel: departmandaki aktif STAFF arasından
   `skor = −açık_task_sayısı·w1 − (farklı_bina ? w2 : 0) + son_30g_aynı_tip_tecrübe·w3` en yüksek olan.
3. Uygun personel yoksa `assigned_user_id=NULL` → departman havuzu + Supervisor'a sinyal.

### 4.7 Supervisor Agent (K1 — deterministik karar tablosu)
Sırayla değerlendirilir, ilk eşleşen kural kazanır:

| # | Koşul | Karar |
|---|---|---|
| 1 | Metin geçersiz/boş veya verification < 0.2 | `REQUEST_MORE_INFO` |
| 2 | duplicate_probability ≥ 0.80 | `MERGE_WITH_EXISTING_CASE` |
| 3 | Policy L3 **veya** priority = CRITICAL **veya** güvenlik kuralı | `ESCALATE` |
| 4 | classification confidence < min_confidence_auto **veya** 0.60 ≤ dup < 0.80 | `SEND_TO_HUMAN_REVIEW` |
| 5 | Routing personel buldu | `AUTO_ASSIGN` (L2 ise manager'a bildirim) |
| 6 | Personel yok | `CREATE_TASK` (departman havuzu) |

Çıktı gerekçesi, tetiklenen kuralı ve diğer agent'ların hangi değerlerinin kullanıldığını içerir.

> `ESCALATE` de bir agent kararıdır; `agent_decisions`'a yazılır ve Automation Rate hesabında
> "doğru şekilde insana devredildi" olarak ayrıca raporlanır.

### 4.8 Monitoring Agent (K1, 5 dk'da bir)
| Kontrol | Eylem |
|---|---|
| Geçen süre ≥ SLA'nın %75'i | `SLA_WARNING` (bir kez) + atanan staff'a bildirim |
| `due_at` geçti | `SLA_BREACHED` + manager bildirimi + `escalation_level += 1` |
| ASSIGNED ama `response_due_at` geçti (kabul yok) | `REASSIGN_RECOMMENDATION` (başka personel önerisi) |
| ANALYZING > 5 dk | pipeline yeniden çalıştırılır |
| NEEDS_INFO > 48 sa | REJECTED |

İdempotent: aynı uyarı aynı case için bir kez üretilir (event varlığı kontrolü).

### 4.9 Resolution Agent (K1)
Girdi: completion_note, kanıt fotoğrafı var mı, çalışma süresi, case type.
- Not çok kısa (< 10 karakter) ve fotoğraf yok → `needs_more_evidence`
- Çalışma süresi case type için makul alt sınırın altında (ör. su kaçağı 2 dk) → `needs_more_evidence`
- Notta olumsuz ifade ("yapılamadı", "parça yok", "tedarik") → `reopen` / escalation önerisi
- Aksi halde `resolved` → VERIFICATION → CLOSED
Fotoğrafın AI ile doğrulanması MVP dışı (ileride yerel görsel model eklenebilir).

### 4.10 Analytics Summary Agent (K1 şablon + opsiyonel K3)
- Backend KPI JSON'unu hesaplar; agent **SQL üretmez, DB'ye erişmez**.
- **Varsayılan:** Şablon tabanlı doğal dil üretimi (NLG). Her cümle bir veri alanına bağlıdır:
  `"Son 7 günde {total_cases} case açıldı; önceki döneme göre %{change} {artış/azalış}."`
  → halüsinasyon **imkânsız**.
- **Opsiyonel Ollama:** Şablon çıktısı + JSON verilip yalnızca akıcı hale getirmesi istenir.
  **Halüsinasyon koruması:** Çıktıdaki tüm sayılar girdi JSON'daki sayılarla karşılaştırılır; eşleşmeyen
  sayı varsa LLM çıktısı atılır, şablon metin döner. Nedensellik ifadeleri ("çünkü", "nedeniyle")
  yerine "ilişkili olabilir" dili zorunlu tutulur.

## 5. Autonomy Policy

| Seviye | Anlam | Örnek case type'lar |
|---|---|---|
| L1_AUTONOMOUS | Agent karar verir ve uygular | SOAP_EMPTY, TOILET_PAPER_EMPTY, TRASH_FULL, AREA_DIRTY |
| L2_NOTIFY | Agent uygular, manager bilgilendirilir | PROJECTOR_FAILURE, AIR_CONDITIONER_FAILURE, WIFI_FAILURE, FURNITURE_DAMAGE, OTHER |
| L3_ESCALATE | Agent `ESCALATE` kararı verir, insan karar verir | ELECTRICAL_FAILURE, WATER_LEAK (yüksek şiddet), güvenlik |

`agent_policies` tablosundan okunur; admin panelinden değiştirilebilir (değişiklik `audit_logs`'a yazılır).

## 6. Model Eğitimi ve Veri Stratejisi (`/ai`)

1. **Sentetik veri üretici** (`ai/generators/`): her case type için şablonlar × eş anlamlılar × lokasyon
   ifadeleri × yazım hataları/ASCII yazım ("sabun bitmiş", "sbn yok", "tuvalette sabun kalmamis").
   Hedef ~3.000 örnek.
2. **Gerçek veri (küçük ama değerli):** Sınıf arkadaşlarından anonim Google Form ile ~300–500 serbest
   metin bildirim toplanır, ekip tarafından 2 kişi bağımsız etiketler (Cohen's kappa raporlanır).
3. **Değerlendirme dürüstlüğü:** Test seti **yalnızca gerçek veriden** oluşur (sentetik veri ile test
   etmek başarıyı şişirir). Eğitim: sentetik + gerçeğin eğitim kısmı.
4. **Karşılaştırmalı deney (tez için):** (a) yalnız kural, (b) TF-IDF+LR, (c) embedding+LR →
   accuracy, macro-F1, confusion matrix, gecikme (ms). Sonuçlar `ai/models/.../metrics.json` ve `ml_models`.
5. **Yeniden eğitim döngüsü:** `decision_feedback` → `scripts/export_feedback.py` → eğitim → yeni versiyon;
   aktif model `ml_models.is_active` ile seçilir.

## 7. Kaynak Gereksinimi

| Bileşen | RAM | Not |
|---|---|---|
| TF-IDF + LR modeli | ~20–50 MB | Ücretsiz hosting'te rahat çalışır |
| MiniLM embedding (opsiyonel) | ~500 MB | Staging'de kapalı olabilir, TF-IDF fallback |
| Ollama 3B model (opsiyonel) | ~3–4 GB | Sadece demo bilgisayarında; staging/prod'da `LLM_PROVIDER=none` |
