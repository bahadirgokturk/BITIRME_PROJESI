# TESTING — Test Stratejisi

## Piramit

| Seviye | Araç | Kapsam | Hedef |
|---|---|---|---|
| Unit (backend/ai) | pytest | workflow geçişleri, SLA hesabı, priority skoru, routing, duplicate skoru, supervisor karar tablosu, verification, resolution, analytics hesapları, Türkçe normalizasyon | Backend toplam satır kapsamı ≥ %85; CI'da zorunlu (`fail_under`, altında backend işi kırmızı). 31.10.2026 ölçümü: %99 |
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

### Nasıl çalışır?

İki ayrı Playwright takımı var:

| Takım | Komut (`frontend/`) | API | Ne dener? |
|---|---|---|---|
| `e2e/` | `npm run test:e2e` | Sahte (uygulama içi) | Ekranların telefon ve masaüstünde işlediği: bildirim yapan, müdür, yönetici. Backend gerekmez. |
| `e2e-real/` | `npm run test:e2e:real` | **Gerçek backend + agent'lar** | Ana senaryo, iki alternatif ve yorumlar. Önce `docker compose up -d`, `alembic upgrade head`, `seeds.run --demo`. |

`e2e-real/` senaryoları:

1. **Ana senaryo** (`main-flow.spec.ts`): bildiren "sabun bitmiş" bildirir → agent'lar türü bulur ve görevi atar
   (kararlar API'den doğrulanır: `SOAP_EMPTY`; `AUTO_ASSIGN` ya da `CREATE_TASK`) → müdür listede görür (Genel Bakış'taki kapanan sayısı not edilir) → personel kabul eder,
   başlatır, not ve fotoğrafla tamamlar → bildirim kapanır → bildiren puan verir → Genel Bakış'ta kapanan bildirim sayısı 1 artar; müdür detay ekranında yapay zekâ kararlarını ve tüm geçmişi görür.
2. **Alternatif — yetki** (`alternative-flows.spec.ts`): başka bir bildiren aynı bildirimi açamaz ("Kayıt bulunamadı").
3. **Alternatif — insan kararı**: "priz kıvılcım çıkarıyor" bildirimi kritik sayılır, agent'lar atamaz; müdür
   İnceleme Kuyruğu'nda yapay zekâ gerekçesini görür, bildirimin kendi ekranından onaylar; teknisyen tamamlar.
4. **Yorumlar** (`comments.spec.ts`): bildiren yorum yazar → personel görev ekranında görür ve iç not ekler →
   bildiren iç notu görmez → müdür ikisini de görür.

Dikkat edilecekler:

- Her koşu yönetici API'siyle **kendi deneme binasını** açar ve sonunda pasife alır. Duplicate Agent aynı binadaki
  açık bildirimlere baktığı için sabit bir konum, yarıda kalmış bir koşudan ya da elle açılmış bir bildirimden
  etkilenirdi.
- Frontend `http://localhost:3000` adresinde açılır (backend'in CORS izni). O portta geliştirme sunucusu
  çalışıyorsa önce kapatılmalı.
- Demo parolası koda yazılmaz: `SEED_DEMO_PASSWORD` ortam değişkeninden ya da depo kökündeki `.env`'den okunur.
- Senaryolar veritabanına yazar (her koşuda 2 bildirim ve 2 pasif deneme binası). Jüri demosunun veritabanında koşturulmaz.

## Kurallar

- Testler birbirinden bağımsız; her integration testi transaction rollback ile izole.
- Zaman bağımlı testlerde `freezegun`; random içeren kodda sabit seed.
- Bug fix PR'ı, bug'ı yakalayan bir testle birlikte gelir.
