# API — Endpoint Taslağı (v1)

Base: `/api/v1`. JSON. Auth: `Authorization: Bearer <access_token>`. OpenAPI: `/docs`.
Hata formatı: `{"error": {"code": "INVALID_TRANSITION", "message": "...", "details": {}}}`.
Yetki: giriş yok/geçersiz → `401 UNAUTHORIZED`; rol bu endpoint'e erişemez → `403 FORBIDDEN`;
ID ile istenen kaynağa erişim yok → `404 NOT_FOUND` (kaynağın varlığı sızdırılmaz).
Listeler: `?page=1&page_size=20&sort=-created_at` → `{"items": [], "total": 0, "page": 1}`.

> **Uygulama durumu:** Sözleşme önce ilerlenir ([PROJECT_PLAN.md](PROJECT_PLAN.md) §1). Şeması yayınlanıp iş mantığı
> henüz yazılmamış endpoint'ler `501 NOT_IMPLEMENTED` döner; girdi doğrulaması (422) şimdiden çalışır.
> Güncel liste: `backend/tests/unit/test_api_contract.py` → `CONTRACT_STUBS`. Frontend bu endpoint'ler için
> sahte veri (MSW) kullanır. Kesin şemalar için `http://localhost:8000/docs`.

## Auth — ✅ uygulandı
Yanıt: `TokenRead {access_token, token_type: "bearer", expires_in}` (access token 30 dk).
- Refresh token **yalnız cookie'de**: `cf_refresh`, `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`,
  local dışında `Secure`. Veritabanında yalnız sha256 hash'i tutulur (`refresh_tokens`).
- **Rotasyon:** her `/auth/refresh` eski token'ı iptal edip yenisini verir. İptal edilmiş bir token tekrar
  gelirse (çalınma belirtisi) kullanıcının **tüm** oturumları kapatılır. İstisna: az önce rotasyonla
  yenilenmiş token **10 sn** içinde tekrar gelirse (iki sekme aynı anda yeniledi) yalnız `401` döner,
  oturumlar kapatılmaz (`REFRESH_REUSE_GRACE_SECONDS`).
- Yanlış e-posta, yanlış parola ve pasif kullanıcı aynı `401 UNAUTHORIZED` + aynı mesajı alır.
- Korumalı endpoint'ler `Authorization: Bearer <access_token>` ister; yoksa/geçersizse `401`.
- **Hız sınırı:** 15 dk içinde e-posta başına 5, IP başına 20 hatalı deneme → `429 TOO_MANY_REQUESTS` +
  `Retry-After` başlığı; engelliyken doğru parola da `429` alır. Kayıtlı olmayan e-postalar da aynı kurala
  tabidir. Başarılı giriş o e-postanın sayacını sıfırlar. Sayaçlar bellekte (tek instance varsayımı).

| Method | Path | Rol | Açıklama |
|---|---|---|---|
| POST | `/auth/login` | public | email+parola → access token + refresh cookie |
| POST | `/auth/refresh` | cookie | yeni access token |
| POST | `/auth/logout` | auth | |
| GET | `/auth/me` | auth | profil + rol |

## Lokasyon seçici — ✅ uygulandı
`GET /locations`: tüm roller; yalnız kendi kurumunun **aktif** lokasyonları, ağaç sırasında (`path`).
Yanıt `Page[LocationOption]` (`id, parent_id, kind, code, name, path, aliases`); önem ağırlığı gibi yönetim
alanları dönmez. Bildirim formu bunu kullanır; yönetim `/admin/locations`'tadır.
`?q=`: ad, kod ve takma adlarda arama (Türkçe normalize: "kutuphane" → "Kütüphane"; büyük/küçük harf fark etmez);
`total` filtrelenmiş sayıdır. Kampüs ölçeğinde (yüzlerce konum) bellekte filtrelenir.

## Cases
✅ **Uygulandı (E3-1):** `POST /cases`, `GET /cases` (`?status=` tekrarlanabilir, en yeni önce),
`GET /cases/mine`, `GET /cases/{id}`, `GET /cases/{id}/events`.
- Yeni bildirim `NEW` olarak kaydedilir ve aynı istekte `ANALYZING`'e geçer; zaman çizelgesinde `CASE_CREATED` +
  `ANALYSIS_STARTED`. Agent hattı (FAZ 5) gelene kadar `ANALYZING`'de bekler.
- Numara `CASE-000124` (PostgreSQL sequence, id'den bağımsız). Başlık boşsa açıklamanın ilk 60 karakteri; kelime ortasından kesilmez, kısaltılınca sonuna `…` eklenir.
- Başka kurumun ya da pasif lokasyon → `404`.
- Görme kapsamı (liste ve detay aynı kural): REPORTER kendi bildirimleri; STAFF kendi bildirdiği + kendisine
  atanan + departmanına yönlendirilen; MANAGER/ADMIN kurumun tümü. Kapsam dışı kayıt → `404`.
- Zaman çizelgesi: REPORTER yalnız kamuya açık olayları görür ve `metadata` boş döner. Görünenler:
  `CASE_CREATED, ANALYSIS_STARTED, AI_CLASSIFIED ("incelendi"), ROUTED ("birime yönlendirildi"), INFO_REQUESTED,
  INFO_PROVIDED, CASE_MERGED, TASK_CREATED, WORK_STARTED, WORK_COMPLETED, CASE_CLOSED, CASE_REOPENED,
  CASE_REJECTED, FEEDBACK_SUBMITTED`. Diğer agent kararları, SLA uyarıları ve yorum olayları gizli.
- Durum değişiklikleri yalnız `WorkflowService` ile (docs/WORKFLOW.md); tablo dışı geçiş → `409 INVALID_TRANSITION`.

`POST /cases` gövdesi JSON:
`{description (10–2000 karakter), location_id, title?}`; tür, birim ve öncelik kullanıcıdan istenmez (agent'lar
belirler). Fotoğraf ayrı istekle: `POST /cases/{id}/attachments` (E3-3). Yanıt `CaseRead`: `case_number`
(`CASE-000124`), `status`, özet `location`/`case_type`/`department`, zaman damgaları.

| Method | Path | Rol | Açıklama |
|---|---|---|---|
| POST | `/cases` | tümü | case oluştur (JSON; foto ayrı istekle) → 201 `ANALYZING` |
| GET | `/cases` | M/A (tümü), R (kendi), S (kapsam) | filtre: status, category, location_id, department_id, priority, sla_status, from, to, q |
| GET | `/cases/mine` | R | kendi case'lerim |
| GET | `/cases/{id}` | kapsam | detay (+ SLA durumu hesaplanmış) |
| GET | `/cases/{id}/events` | kapsam | zaman çizelgesi (reporter'a filtrelenmiş) |
| GET | `/cases/{id}/decisions` | M/A | agent kararları + gerekçeler (koşu sırasıyla; `run_id`, `reasons`, `output`) ✅; Türkçe başlıklar `agent_label` ("Sınıflandırma") ve `decision_label` ("Sabun bitti", "Müdüre yükseltildi"; bilinmiyorsa `null`, kod gösterilir) |
| POST | `/cases/{id}/info` | R (sahip) | NEEDS_INFO iken `{body}` → `ANALYZING`, yanıt herkese açık yorum olarak da eklenir ✅ |
| POST | `/cases/{id}/comments` | kapsam (ADMIN hariç) | `{body, is_internal}` ✅ |
| GET | `/cases/{id}/comments` | kapsam | yorumlar (reporter iç notları görmez) ✅ |
| POST | `/cases/{id}/attachments` | kapsam (ADMIN hariç) | fotoğraf yükleme (multipart, alan adı `file`) ✅ |
| GET | `/cases/{id}/attachments` | kapsam | bildirimin fotoğrafları ✅ |
| GET | `/attachments/{id}` | kapsam | fotoğrafı indirme (yetki kontrollü) ✅ |
| POST | `/cases/{id}/feedback` | R (sahip) | `{rating 1–5, comment?}` → `CaseRead` ✅ |
| POST | `/cases/{id}/reopen` | R (sahip, 72 sa) / M | `{reason}` → `CaseRead` ✅ |

### Fotoğraf ve video — ✅ uygulandı (E3-3)
- Yetki bildirimi görme kuralıyla aynı (kapsam dışı → `404`); ADMIN yükleyemez (`403`, görev ayrılığı).
  Personelin yüklediği `EVIDENCE` (iş kanıtı), diğerleri `REPORT`.
- Tür **içerikten** anlaşılır (magic bytes), dosya adına/Content-Type'a bakılmaz: yalnız JPG, PNG, WEBP →
  aksi `415 UNSUPPORTED_MEDIA_TYPE` (video için aşağıya bakın). Boyut `MAX_UPLOAD_MB` (varsayılan 10; telefon fotoğrafı 4-8 MB) → aşılırsa `413 FILE_TOO_LARGE`.
- Fotoğraf sunucuda yeniden kodlanır: telefon döndürmesi uygulanır, **EXIF (GPS konumu, cihaz) silinir**.
  Sıkıştırma bombası ve bozuk dosya `415`. Bildirim başına en fazla 5 fotoğraf (`409`).
- **Video:** MP4/MOV (telefon kaydı), en fazla **30 sn** (+0,5 sn pay) → aşılırsa `422 VIDEO_TOO_LONG`,
  en fazla `MAX_VIDEO_MB` (varsayılan 50) → `413`. Süre dosyanın `moov/mvhd` kutusundan okunur (ffmpeg yok).
  Konum/üst veri kutuları (`udta`, `meta`, `uuid`) **aynı boyutta boş `free` kutusuna** çevrilir; video yeniden
  kodlanmaz, dosya oynamaya devam eder. Oynatılabilirlik sunucuda doğrulanmaz (tür içerikten, indirme `nosniff`).
  Fotoğraf ve videolar aynı 5'lik kotayı paylaşır.
- Depoda rastgele ad (`<case_id>/<32 hex>.png`); kullanıcının dosya adı yalnız gösterimde, dizin kısımları atılmış.
- İndirme `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` ile döner. Bearer token
  gerektirdiği için `<img src>` ile değil, `fetch` + blob URL ile gösterilir.

### Yorum, puan, yeniden açma — ✅ uygulandı (E3-5)
Önce bildirimi görme kuralı (yoksa `404`), sonra işlemin rol kuralı (yoksa `403`):
- **Yorum:** ADMIN dışında bildirimi gören herkes herkese açık yorum yazar. `is_internal: true` (iç not) yalnız
  STAFF ve MANAGER yazar ve görür; reporter listede iç notları hiç görmez. Yanıtta `author_name`, `author_role`.
  Zaman çizelgesine `COMMENT_ADDED` yazılır (metin değil, yalnız yorum id'si).
- **Puan:** yalnız bildirim yapan, `CLOSED` bildirimde, son kapanıştan **72 saat** içinde, **bir kez**
  (aksi `409`). `FEEDBACK_SUBMITTED` olayı.
- **Yeniden açma:** bildirim yapan (kapanmışsa son kapanıştan 72 saat içinde → aksi `409 REOPEN_WINDOW_CLOSED`)
  ya da MANAGER (her zaman). STAFF/ADMIN `403`. Geçiş `WorkflowService` ile (`CLOSED`/`VERIFICATION` →
  `REOPENED`, aksi `409 INVALID_TRANSITION`), `reopened_count` artar, `CASE_REOPENED` olayı (gerekçe metadata'da).

## Manager işlemleri
Sözlükler (MANAGER, ADMIN; diğer roller `403`): `GET /case-types` → aktif türler `[{id, code, name, category, default_department}]`, `GET /departments` → aktif birimler `[{id, code, name}]`. Düzeltme (`override`) kodları ve atama `department_id`'si buradan seçilir.

| Method | Path | Açıklama |
|---|---|---|
| GET | `/manager/review-queue` | `ESCALATED` + (`CLASSIFIED` ve `needs_human_review`) ✅ E5-9: en kritik ve en eski önce; satır `{case, reason_code, reason, confidence, possible_duplicate_of}` (Supervisor gerekçesi; personel reddettiyse boş). E5-6: `possible_duplicate_of` = Duplicate Agent'ın "aynı sorun olabilir" dediği bildirim `{id, case_number, title}` |
| POST | `/cases/{id}/assign` | `{department_id, user_id?}` ✅ (E4-1, ayrıntı: Tasks) |
| POST | `/cases/{id}/request-info` | `{question}` ✅: `ANALYZING` → `NEEDS_INFO`, `INFO_REQUESTED` (soru metadata'da), soru `CaseRead.info_request`'te; başka durumda `409` |
| POST | `/cases/{id}/override` | `{field, corrected_value, reason}` → `decision_feedback` + `DECISION_OVERRIDDEN` ✅ E5-9: `field` = `case_type` (tür kodu, kategori de değişir) \| `priority` \| `department` (birim kodu); bilinmeyen değer `422 INVALID_OVERRIDE_VALUE`; gerekçe zorunlu; düzeltme ilgili agent'ın son kararına bağlanır; reporter bu olayı görmez |
| POST | `/cases/{id}/merge` | `{parent_case_id, reason}` ✅ E5-6: bildirim `MERGED` olur, ana bildirimin `duplicate_count`'u artar (bağlı bildirim + ona daha önce bağlananlar), iki bildirime de `CASE_MERGED` olayı; `decision_feedback`'e `field=duplicate` (agent önerisi → manager kararı, bildirim numarasıyla). Ana bildirim kendisi ya da sorunu kapanmış/bağlanmış ise `409 INVALID_MERGE_TARGET`; atanmış bildirim `409 INVALID_TRANSITION` |
| POST | `/cases/{id}/reject` | `{reason}` ✅ E5-9: `REJECTED`, kuyruktan çıkar; atanmış bildirim `409` |
| POST | `/cases/{id}/close` | `{reason}` ✅ E5-11: tamamlanan işi doğrula (`VERIFICATION` → `CLOSED`), kuyruktan çıkar; Resolution kararı varsa `decision_feedback`'e `field=resolution` (agent kararı → `RESOLVED`); başka durumda `409`. Kuyruğa `VERIFICATION` + `needs_human_review` bildirimleri de düşer (`reason_code`: `NOTE_TOO_SHORT`, `TOO_QUICK`, `NOT_DONE`…) |
| POST | `/cases/{id}/reanalyze` | pipeline'ı tekrar çalıştır |

## Tasks (Staff)
✅ **Uygulandı (E4-1, E4-2)**.
- **SLA (E4-2):** ilk atamada kural eşleşir — önce (bildirim tipi, öncelik), yoksa (varsayılan, öncelik); öncelik
  yoksa bildirim tipinin başlangıç önceliği, o da yoksa `MEDIUM`. Hedefler **bildirimin oluşturulmasından**
  ölçülür (`response_due_at`, `due_at`); yeniden atama saati sıfırlamaz. `sla_status` **okuma anında** hesaplanır:
  süre dolmuşsa `BREACHED`, kuralın eşiği (varsayılan %75) geçmişse `AT_RISK`, değilse `ON_TRACK`; çözülmüş
  işte karar çözüm anına göre verilir ve değişmez. Kural yoksa `due_at` ve `sla_status` `null`.
- **Kim görür:** STAFF kendisine atanan görevleri + departmanının **sahipsiz kuyruğunu**; MANAGER/ADMIN kurumdaki
  tüm görevleri (detay). Kapsam dışı → `404`. İşlemleri (kabul/başlat/tamamla/reddet) yalnız STAFF yapar (`403`).
- `/tasks/mine` filtresiz çağrılınca yalnız aktif görevler (`PENDING`, `ACCEPTED`, `IN_PROGRESS`) döner.
- Kuyruktaki görevi **ilk kabul eden üstlenir** (`assigned_user_id` o kişi olur).
- Yanlış sırada işlem → `409 INVALID_TRANSITION` (tablo: `workflow.py` `TASK_TRANSITIONS`).
Yanıt `TaskRead`: görev + bildirim özeti (`case_number`, `title`, `description`, `location`, `priority`) ve
`due_at` / `sla_status` (`ON_TRACK` | `AT_RISK` | `BREACHED`, kural yoksa `null`). Liste SLA'ya kalan süreye
göre sıralanır (en acil üstte). `CaseRead` de `sla_status` alanını taşır.

| Method | Path | Açıklama |
|---|---|---|
| GET | `/tasks/mine` | atanan görevlerim (`?status=` tekrarlanabilir) |
| GET | `/tasks/{id}` | detay (+ bildirim özeti, lokasyon) |
| POST | `/tasks/{id}/accept` | `PENDING` → `ACCEPTED` |
| POST | `/tasks/{id}/decline` | `{reason}`; `PENDING`/`ACCEPTED` → `DECLINED` |
| POST | `/tasks/{id}/start` | `ACCEPTED` → `IN_PROGRESS` |
| POST | `/tasks/{id}/complete` | `{completion_note?}`; `IN_PROGRESS` → `COMPLETED` → Resolution Agent |
| POST | `/cases/{id}/attachments` | **kanıt fotoğrafı**: personelin yüklediği `EVIDENCE` olarak işaretlenir (ayrı uç yok) |

Manager ataması: `POST /cases/{id}/assign` `{department_id, user_id?}` → görev oluşur, bildirim `ASSIGNED`.
Yalnız MANAGER (rol kontrolü doğrulamadan önce, diğerleri `403`). Departman başka kurumun ya da pasif → `404`;
seçilen kişi o departmanın aktif STAFF'ı değilse `422 INVALID_ASSIGNEE`. Aktif görev varsa `CANCELLED` olur
(`TASK_REASSIGNED`), yenisi açılır. Bildirim `ANALYZING` ise önce `CLASSIFIED` olur (`ROUTED`, elle yönlendirme).

## Analytics (Manager/Admin)
Ortak parametreler: `from`, `to`, `department_id?`, `building_id?`

📄 **Sözleşme yayında (FAZ 6):** tüm şemalar OpenAPI'de (`KpisRead`, `TrendRead`, `CategoriesRead`, `LocationsRead`,
`ResolutionTimesRead`, `SlaRead`, `AgingRead`, `DepartmentsRead`, `RecurringRead`, `ProcessRead`, `SummaryRead`,
`AgentMetricsRead`; `backend/app/schemas/analytics.py`). ✅ işaretliler gerçek veri döner (E6-2/E6-3); diğerleri iş
mantığı gelene kadar `501 NOT_IMPLEMENTED` döner, frontend onlar için MSW ile çalışır. `building_id` başka kurumun
lokasyonuysa `404`. Ortak kurallar: rol (yalnız MANAGER/ADMIN, diğerleri `403`) ve
parametre doğrulaması (`from` > `to` ya da 366 günden uzun dönem → `422 INVALID_PERIOD`; bilinmeyen
`granularity`/`level` → `422`). Varsayılan dönem: bugün dahil son 7 gün (Europe/Istanbul). Süreler dakika, oranlar
yüzde (0–100); veri yoksa `null` (ekran "–" gösterir). KPI kartları `{value, previous, delta_pct}`.
| Method | Path | Açıklama |
|---|---|---|
| GET | `/analytics/kpis` | ✅ KPI kartları |
| GET | `/analytics/trend?granularity=day\|week\|month` | ✅ case trendi |
| GET | `/analytics/categories` | ✅ kategori/tip dağılımı |
| GET | `/analytics/locations` | ✅ bina/kat/alan bazlı yoğunluk |
| GET | `/analytics/resolution-times` | ✅ kategori bazında avg/median/p90 |
| GET | `/analytics/sla` | ✅ SLA uyum/ihlal |
| GET | `/analytics/aging` | ✅ açık case yaş kovaları |
| GET | `/analytics/departments` | departman performansı |
| GET | `/analytics/recurring` | tekrarlayan problemler |
| GET | `/analytics/process` | event log'dan ortalama adım süreleri (darboğaz) |
| POST | `/analytics/summary` | `{period: "7d"}` → KPI JSON + doğal dil özeti (agent E5-12 ✅; endpoint KPI servisiyle E6-2) |

## Agents
| Method | Path | Açıklama |
|---|---|---|
| GET | `/agents/metrics` | 📄 sözleşme (`AgentMetricsRead`): automation, human review, classification accuracy, dup precision; agent bazında karar sayısı, ortalama güven, override oranı |
| GET | `/agents/decisions` | filtre: agent_name, decision, from, to |
| GET | `/agents/models` | `ml_models` listesi ve metrikleri |

## Admin
**Erişim:** tüm `/admin/*` yalnız **ADMIN** (MANAGER dahil diğer roller `403 FORBIDDEN`, giriş yoksa `401`).
Rol kontrolü girdi doğrulamasından önce çalışır. Başka kurumun kaydı `404` döner (IDOR, `services/authorization.py`).

- ✅ **`/admin/departments`** ve **`/admin/locations`** uygulandı: listele (`Page`), ekle (`201`), güncelle
  (`PATCH`, yalnız gönderilen alanlar). Aynı kurumda tekrar eden kod → `409 CONFLICT`. Başka kurumun kaydı → `404`.
  Lokasyon `path`'i sunucuda hesaplanır (`KMP/B/B-2`); liste ağaç sırasında (`path`'e göre) döner. Lokasyon
  taşınınca (`parent_id`) tüm alt ağacın `path`'i güncellenir; `parent_id: null` köke taşır; kendi altına
  taşıma → `422 INVALID_PARENT`. Lokasyon kodunda `/` kullanılamaz.
- ✅ **`/admin/users`** uygulandı. E-posta küçük harfe çevrilip saklanır ve tüm sistemde tekildir (tekrar →
  `409 CONFLICT`); parola en az 8 karakter, yanıtta asla dönmez. Rol kuralları (ihlal → `422 INVALID_USER_ROLE`):
  `REPORTER` → `reporter_kind` zorunlu; diğer rollerde `reporter_kind` boş; `STAFF`/`MANAGER` → `department_id`
  zorunlu ve aynı kurumdan (başka kurumun departmanı → `404`). Rol değişince eski `reporter_kind` otomatik silinir.
  `is_active: false` kullanıcının **tüm oturumlarını anında kapatır**; yeniden aktifleştirmek eski oturumu geri
  getirmez. Admin kendini pasifleştiremez veya ADMIN rolünü kaldıramaz → `409 SELF_LOCKOUT`.

FAZ 2 sözleşmesi yayında: `GET/POST /admin/{users,departments,locations}`, `PATCH /admin/{...}/{id}`
(liste yanıtı `Page[T]`, `?page=&page_size=` en fazla 200). Diğerleri FAZ 2–4'te eklenir.
CRUD: `/admin/users`, `/admin/departments`, `/admin/locations`, `/admin/case-types`, `/admin/sla-rules`,
`/admin/agent-policies`; `GET /admin/audit-logs`. Silme yerine `is_active=false` (soft delete).

## Internal / Sistem
| Method | Path | Açıklama |
|---|---|---|
| GET | `/health` | liveness + DB + model yüklü mü |
| POST | `/internal/monitoring/run` | `X-Internal-Token` ile; cron yedeği |
| GET | `/lookups` | aktif lokasyonlar, case type'lar (form doldurma için) |
