# API — Endpoint Taslağı (v1)

Base: `/api/v1`. JSON. Auth: `Authorization: Bearer <access_token>`. OpenAPI: `/docs`.
Hata formatı: `{"error": {"code": "INVALID_TRANSITION", "message": "...", "details": {}}}`.
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

## Cases
| Method | Path | Rol | Açıklama |
|---|---|---|---|
| POST | `/cases` | tümü | case oluştur (multipart: foto opsiyonel) → 201 `ANALYZING` |
| GET | `/cases` | M/A (tümü), R (kendi), S (kapsam) | filtre: status, category, location_id, department_id, priority, sla_status, from, to, q |
| GET | `/cases/mine` | R | kendi case'lerim |
| GET | `/cases/{id}` | kapsam | detay (+ SLA durumu hesaplanmış) |
| GET | `/cases/{id}/events` | kapsam | zaman çizelgesi (reporter'a filtrelenmiş) |
| GET | `/cases/{id}/decisions` | M/A | agent kararları + gerekçeler |
| POST | `/cases/{id}/info` | R (sahip) | NEEDS_INFO iken ek bilgi → yeniden analiz |
| POST | `/cases/{id}/comments` | kapsam | `{body, is_internal}` |
| POST | `/cases/{id}/attachments` | kapsam | dosya yükleme |
| GET | `/attachments/{id}` | kapsam | dosya indirme (yetki kontrollü) |
| POST | `/cases/{id}/feedback` | R (sahip) | `{rating, comment}` |
| POST | `/cases/{id}/reopen` | R (sahip, 72 sa) / M | `{reason}` |

## Manager işlemleri
| Method | Path | Açıklama |
|---|---|---|
| GET | `/manager/review-queue` | `needs_human_review=true` + `ESCALATED` case'ler |
| POST | `/cases/{id}/assign` | `{department_id, user_id?}` |
| POST | `/cases/{id}/override` | `{field, corrected_value, reason}` → `decision_feedback` + `DECISION_OVERRIDDEN` |
| POST | `/cases/{id}/merge` | `{parent_case_id}` |
| POST | `/cases/{id}/reject` | `{reason}` |
| POST | `/cases/{id}/reanalyze` | pipeline'ı tekrar çalıştır |

## Tasks (Staff)
| Method | Path | Açıklama |
|---|---|---|
| GET | `/tasks/mine` | atanan görevlerim (status filtresi) |
| GET | `/tasks/{id}` | detay (+ case özeti, lokasyon) |
| POST | `/tasks/{id}/accept` | |
| POST | `/tasks/{id}/decline` | `{reason}` |
| POST | `/tasks/{id}/start` | |
| POST | `/tasks/{id}/evidence` | kanıt fotoğrafı |
| POST | `/tasks/{id}/complete` | `{completion_note}` → Resolution Agent |

## Analytics (Manager/Admin)
Ortak parametreler: `from`, `to`, `department_id?`, `building_id?`
| Method | Path | Açıklama |
|---|---|---|
| GET | `/analytics/kpis` | KPI kartları |
| GET | `/analytics/trend?granularity=day\|week\|month` | case trendi |
| GET | `/analytics/categories` | kategori/tip dağılımı |
| GET | `/analytics/locations` | bina/kat/alan bazlı yoğunluk |
| GET | `/analytics/resolution-times` | kategori bazında avg/median/p90 |
| GET | `/analytics/sla` | SLA uyum/ihlal |
| GET | `/analytics/aging` | açık case yaş kovaları |
| GET | `/analytics/departments` | departman performansı |
| GET | `/analytics/recurring` | tekrarlayan problemler |
| GET | `/analytics/process` | event log'dan ortalama adım süreleri (darboğaz) |
| POST | `/analytics/summary` | `{period: "7d"}` → KPI JSON + doğal dil özeti |

## Agents
| Method | Path | Açıklama |
|---|---|---|
| GET | `/agents/metrics` | accuracy, avg confidence, automation, human review, override, dup precision |
| GET | `/agents/decisions` | filtre: agent_name, decision, from, to |
| GET | `/agents/models` | `ml_models` listesi ve metrikleri |

## Admin
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
