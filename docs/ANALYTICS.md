# ANALYTICS — KPI Tanımları

Tüm hesaplamalar `backend/app/analytics/` içinde, SQL + Python ile yapılır. Zaman aralığı parametreli;
süreler dakika cinsinden hesaplanır, UI'da okunur formatta gösterilir. `MERGED` ve `REJECTED` case'ler
süre metriklerine dahil edilmez (sayım metriklerinde ayrı gösterilir).

## 1. KPI Kartları

| KPI | Formül |
|---|---|
| Total Cases | aralıkta `created_at` olan case sayısı (MERGED hariç) |
| Open Cases | terminal olmayan case sayısı (anlık) |
| Closed Cases | aralıkta `closed_at` olan case sayısı |
| Cases Today | bugün (Europe/Istanbul) açılan |
| Avg / Median Resolution Time | `resolved_at − created_at` ortalama / medyan |
| First Response Time | `accepted_at − created_at` (medyan önerilir) |
| Assignment Time | `assigned_at − created_at` |
| SLA Compliance Rate | `resolved_at ≤ due_at` olan kapanmış case / SLA'lı kapanmış case |
| SLA Breach Rate | `SLA_BREACHED` event'i olan case / SLA'lı case |
| Reopen Rate | `reopened_count > 0` / kapanmış case |
| Automation Rate | Supervisor kararı `AUTO_ASSIGN`/`CREATE_TASK` olan **ve** kapanışa kadar `DECISION_OVERRIDDEN` veya manuel atama olmayan case / analiz edilen case |
| Human Review Rate | `SEND_TO_HUMAN_REVIEW` + `ESCALATE` kararlı case / analiz edilen case |

Her KPI önceki eşit uzunluktaki dönemle karşılaştırılır (`delta_pct`; önceki değer 0 ya da yoksa `null`).

**Uygulamadaki netleştirmeler** (`backend/app/analytics/`, E6-2):

| Konu | Karar |
|---|---|
| Dönem | `from`–`to` Europe/Istanbul günleri, iki uç dahil; sorgular `[başlangıç, bitiş)` yarı açık aralık |
| Süre metrikleri | Ölçülen olay dönemde olanlar: çözüm süresi dönemde **çözülenler**, ilk yanıt dönemde **kabul edilenler**, atama dönemde **atananlar** |
| Open Cases | Dönem sonundaki (bugünse şu anki) açık sayı: o ana kadar açılmış, kapanmamış; REJECTED/MERGED hiç açık sayılmaz. Önceki değer = önceki dönemin sonu |
| Cases Today | Bugün; önceki değer dün |
| SLA Compliance | Dönemde kapanan ve `due_at`'i olan bildirimler |
| SLA Breach | Dönemde açılan ve `due_at`'i olan bildirimler içinde `SLA_BREACHED` olayı olanlar |
| Automation / Human Review | Dönemde açılan ve Supervisor'dan geçen bildirimler; her bildirimin **son** Supervisor kararı. "İnsan dokundu" = `DECISION_OVERRIDDEN` olayı ya da kullanıcının yaptığı `TASK_CREATED`/`TASK_REASSIGNED` |
| Sayım dışı | MERGED tüm sayımlardan, REJECTED ayrıca süre metriklerinden düşer |

## 2. Raporlar

- **Trend:** `date_trunc(granularity, created_at)` bazında sayım; açılan vs kapanan iki seri.
- **Kategori dağılımı:** category → case_type kırılımı.
- **Lokasyon analizi:** `locations.path` ile bina / kat / alan seviyesinde toplama (heatmap: bina × kategori).
  Seviye derinlikten değil türden bulunur: bina = yoldaki `BUILDING` (yoksa kampüsün doğrudan alt düğümü, ör. bahçe);
  kat = yoldaki `FLOOR` (yoksa binası); alan = lokasyonun kendisi.
- **Çözüm süresi:** kategori bazında avg, median (`percentile_cont(0.5)`), p90 (`percentile_cont(0.9)`).
- **Aging:** açık case'ler `now − created_at` → 0–2, 2–6, 6–12, 12–24, 24+ saat kovaları.
- **Departman performansı:** case sayısı, avg/median çözüm, SLA uyumu, açık iş yükü, personel başına açık task.
- **Recurring problems:** son 30 gün, `(location_id, case_type_id)` grubunda `count ≥ RECURRING_THRESHOLD`
  (varsayılan 5; config). Çıktı: lokasyon yolu, tip, sayı, son olay, ortalama çözüm süresi, trend.
  Örn. *B Blok / 2. Kat / Erkek WC — SOAP_EMPTY — 17 case*. Öneri metni: "Kalıcı çözüm (dispenser
  kapasitesi / periyodik kontrol) değerlendirilebilir."
- **Süreç analitiği (event log):** ardışık event çiftleri arasındaki ortalama/medyan süre
  (ör. `TASK_CREATED → TASK_ACCEPTED`) → en uzun adım = darboğaz. Departman bazında karşılaştırma.

## 3. Agent Performansı

| Metrik | Tanım |
|---|---|
| Classification accuracy | AI tahmini = nihai (insan onaylı/düzeltilmiş) case_type olan / etiketli case. Seed verisinde `ground_truth` alanı ile; canlıda override yoksa onaylanmış kabul edilir (varsayım raporlanır) |
| Macro-F1 (offline) | `ml_models.metrics_json` — gerçek test seti |
| Average confidence | classification kararlarının ortalama confidence'ı; doğru/yanlış tahminler için ayrı (kalibrasyon grafiği) |
| Automatic routing rate | Routing önerisi değiştirilmeden uygulanan / toplam |
| Routing accuracy | Nihai departman = önerilen departman / toplam |
| Human review rate | yukarıda |
| Decision override rate | `decision_feedback` sayısı / ilgili agent karar sayısı (agent bazında) |
| Duplicate detection precision / recall | Seed'de bilinen duplicate kümelerine göre; canlıda manager onay/ret |
| Automation rate | yukarıda |

## 4. Araştırma Soruları ↔ Metrikler

| RQ | Ölçüm |
|---|---|
| RQ1 Sınıflandırma doğruluğu | Offline: gerçek test setinde accuracy, macro-F1, confusion matrix; kural vs ML karşılaştırması. Online: classification accuracy |
| RQ2 Routing doğruluğu | Routing accuracy, reassignment oranı |
| RQ3 İnsan müdahalesinin azalması | Automation rate, human review rate, override rate; "tamamen manuel" senaryoya göre insan dokunuşu sayısı |
| RQ4 Tekrarlayan problemler & darboğazlar | Recurring problems raporu (seed'e gömülü pattern'lerin bulunma oranı), süreç analitiği darboğaz adımı |
| RQ5 Süre & SLA ölçülebilirliği | Tüm lifecycle zaman damgalarının event log'dan türetilebilmesi, SLA compliance / breach, aging |

## 5. AI Yönetim Özeti Girdi Şeması

```json
{
  "period": {"from": "2026-09-19", "to": "2026-09-26"},
  "total_cases": 186, "previous_period_change_pct": 14,
  "top_category": {"code": "CLEANING", "count": 71},
  "highest_problem_location": {"path": "B Blok", "count": 48},
  "sla_compliance_pct": 82, "sla_breaches": 11,
  "recurring_problems": [{"location": "B Blok 2. Kat Erkek WC", "type": "SOAP_EMPTY", "count": 17}],
  "slowest_department": {"name": "Technical Services", "median_resolution_min": 310},
  "automation_rate_pct": 64
}
```
Analytics Agent yalnızca bu JSON'dan özet üretir (bkz. AGENTS.md §4.10).
