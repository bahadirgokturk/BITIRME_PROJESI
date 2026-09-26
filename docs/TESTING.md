# TESTING — Test Stratejisi

## Piramit

| Seviye | Araç | Kapsam | Hedef |
|---|---|---|---|
| Unit (backend/ai) | pytest | workflow geçişleri, SLA hesabı, priority skoru, routing, duplicate skoru, supervisor karar tablosu, verification, resolution, analytics hesapları, Türkçe normalizasyon | Kritik modüllerde ≥ %85 satır kapsama |
| Integration (backend) | pytest + gerçek Postgres (CI service container), `httpx.AsyncClient` | API + DB + pipeline; RBAC/IDOR; upload validation | Her endpoint için en az mutlu yol + yetkisiz erişim |
| Frontend component | Vitest + React Testing Library | Case formu, status badge, SLA göstergesi, KPI kartı, karar gerekçe paneli | Kritik bileşenler |
| E2E | Playwright | Uçtan uca senaryo | 1 ana senaryo + 2 alternatif |
| Model | pytest + `ai/training/evaluate.py` | Sabit test setinde macro-F1 ≥ belirlenen eşik (regresyon testi) | Model değişikliğinde çalışır |

## Kritik Test Senaryoları

- **Workflow:** `ALLOWED_TRANSITIONS` tablosundaki her geçerli geçiş başarılı; tablo dışı her geçiş (parametrize, tüm kombinasyonlar) `InvalidTransitionError`; her geçişte event yazılıyor.
- **SLA:** kural eşleşme önceliği; `due_at` hesabı; ON_TRACK / AT_RISK (%75) / BREACHED sınır değerleri (`freezegun` ile zaman sabitleme).
- **Priority:** "sabun bitti" → MEDIUM; "prizden kıvılcım" → CRITICAL; bant sınırları (39/40, 64/65, 84/85).
- **Duplicate:** aynı WC, 10 dk içinde 3 "sabun yok" → ≥ 0.80; farklı bina → < 0.60; 1 gün sonra → düşük.
- **Supervisor:** karar tablosunun her satırı için bir test + kural önceliği testleri.
- **Güvenlik:** reporter başka reporter'ın case'i → 404; staff başkasının task'ını tamamlayamaz → 404; `.exe` / sahte MIME yükleme → 422; 6 MB → 413.
- **Fallback:** model dosyası yok → kural tabanlı sınıflandırma çalışır, `FALLBACK_USED` gerekçesi var; Ollama kapalı → şablon özet döner.
- **Analytics:** küçük sabit fixture veri setinde her KPI elle hesaplanmış beklenen değerle karşılaştırılır.
- **Summary guard:** LLM çıktısında girdi dışı sayı varsa çıktı reddedilir.

## E2E Ana Senaryo

1. Reporter giriş → `/report` → "B blok 2. kat erkek tuvalette sabun bitmiş" + lokasyon → gönder
2. Case detayında durum `ANALYZING` → `ASSIGNED`; agent kararları görünür (manager hesabında)
3. Staff giriş → `/staff/tasks` → kabul → başlat → not + fotoğraf → tamamla
4. Case `CLOSED`; reporter geri bildirim verir
5. Manager dashboard'da Closed Cases +1, event log'da tüm lifecycle

## Kurallar

- Testler birbirinden bağımsız; her integration testi transaction rollback ile izole.
- Zaman bağımlı testlerde `freezegun`; random içeren kodda sabit seed.
- Bug fix PR'ı, bug'ı yakalayan bir testle birlikte gelir.
