# PROJECT PLAN — CampusFlow AI

## 1. Ekip ve Sorumluluklar

| Kişi | Ana sorumluluk | Ortak katkı / review alanı |
|---|---|---|
| **A** — Bahadır | Backend (API, workflow, SLA, analytics), agent'ların çoğu + ML modeli, CI/DevOps | UI review (API ile uyum) |
| **B** — frontend | Figma'da UI/UX tasarımı, Next.js ekranları (reporter, staff, manager, admin) | Veri etiketleme, E2E, bir agent |
| **C** — frontend | Figma'da UI/UX tasarımı, Next.js ekranları, dashboard ve grafikler | Veri etiketleme, E2E, bir agent |

İş bölümü bir **varsayılandır, duvar değildir**: işlerin çoğu ortak yürür ve backlog'daki "Ortak" satırlarına
herkes katkı verir. Kural: `develop`'a onaysız PR ile girilir; canlıya (`main`) geçişi Bahadır onaylar. Her kişi
haftada en az 1 PR'ı **kendi alanı dışında** inceleyip yorum bırakır (bilgi paylaşımı için). Haftalık 30 dk demo + planlama.

### Çalışma modeli: sözleşme önce (backend ve frontend birbirini beklemez)

Her fazın başında iş şu sırayla ilerler (ayrıntı: [UI_GUIDE.md](UI_GUIDE.md) bölüm 9):

1. **Tasarım bir faz önden gider:** B/C, sonraki fazın ekranlarını Figma'da hazırlar; A ile birlikte gözden geçirilir
   (ekranda gösterilen her veri API'de var mı?).
2. **Sözleşme ilk gün:** A, fazın endpoint'lerini önce **şema** olarak (Pydantic request/response, boş ya da
   sahte veri dönen route) küçük bir PR ile `develop`'a alır.
3. **Paralel geliştirme:** B/C `npm run gen:api` ile tipleri alıp ekranları yazar (gerekirse sahte veriyle);
   A aynı anda iş mantığını ve testlerini tamamlar. Backend, frontend'i hiç beklemez: pytest ve `/docs`
   (Swagger) ile uçtan uca test edilir.
4. **Entegrasyon:** Haftalık demoda gerçek API ile birleştirilir.

## 2. Fazlar ve Haftalar

| Hafta | Faz | Çıktı (demo edilebilir) |
|---|---|---|
| 1 | FAZ 0 | Mimari, ERD, RBAC, state machine, backlog (**bu doküman seti**) |
| 2 | FAZ 1 | Monorepo, Docker Compose, FastAPI + Next.js iskeleti, Postgres + Alembic, CI pipeline |
| 3 | FAZ 2 | Auth (JWT), RBAC, admin: kullanıcı/departman/lokasyon; campus template seed |
| 4 | FAZ 3 | Case oluşturma, state machine, event log, reporter ekranları (`/report`, `/my-cases`); **staging canlıya alınır** (E7-3a) |
| 5 | FAZ 4 | Task yönetimi, SLA engine (due_at, SLA status), staff ekranları taslağı |
| 6 | FAZ 5 | Intake + Classification (kural + TF-IDF/LR v1) + Priority; sentetik veri üretici |
| 7 | FAZ 6 | Duplicate, Verification, Routing, Supervisor; orchestrator; `agent_decisions` |
| 8 | FAZ 7 | Staff lifecycle tamam, case detay zaman çizelgesi, manager review kuyruğu + override |
| 9 | FAZ 8 | Analytics backend (tüm KPI + raporlar), 500+ case demo seed'i |
| 10 | FAZ 9–10 | Manager dashboard, analytics sayfası, agent performans dashboard'u |
| 11 | FAZ 11 + 12 | Monitoring, Resolution, AI yönetim özeti; E2E, güvenlik kontrolü, bug fix |
| 12 | FAZ 12 | UI polish, dokümantasyon, akademik deney sonuçları, sunum + demo provası |

**Paralel iş kolu (B/C, A destekler):** Hafta 2–3'te anonim veri toplama formu yayınlanır, hafta 4–5 etiketleme
(2 kişi bağımsız + kappa), hafta 6'da model v1, hafta 10'da feedback ile model v2 karşılaştırması.

## 3. 12 Haftalık Backlog (Epic → Story)

| ID | Epic / Story | Hafta | Sahip |
|---|---|---|---|
| E1 | **Altyapı** | | |
| E1-1 | Monorepo iskeleti, `.gitignore`, `.env.example`, README | 2 | A ✅ |
| E1-2 | Docker Compose (frontend, backend, postgres) + healthcheck | 2 | A ✅ |
| E1-3 | FastAPI iskeleti (katmanlar, config, logging, hata handler, `/health`) | 2 | A ✅ |
| E1-4 | SQLAlchemy + Alembic, ilk migration (organizations, departments, locations, users) | 2 | A ✅ |
| E1-5 | Next.js iskeleti (Tailwind, shadcn, layout, rol bazlı menü, API client) | 2 | A ✅ (iskelet) → B/C |
| E1-6 | GitHub Actions CI (lint, typecheck, test), branch protection, PR şablonu | 2 | A ✅ |
| E2 | **Kimlik & Yönetim** | | |
| E2-1 | Login/refresh/logout, argon2, JWT | 3 | A |
| E2-2 | RBAC dependency + ownership yardımcıları + testleri | 3 | A |
| E2-3 | Admin CRUD: users, departments, locations (hiyerarşi), case types, SLA, agent policies | 3–4 | A (API) + B/C (ekran) |
| E2-4 | Campus template seed (YAML → DB, idempotent), [DEPARTMENTS.md](DEPARTMENTS.md) matrisinden | 3 | A |
| E2-5 | Audit log | 4 | A |
| E3 | **Case Yönetimi** | | |
| E3-1 | Case modeli, case_number sequence, oluşturma API'si | 4 | A |
| E3-2 | WorkflowService + transition tablosu + event yazımı (%100 test) | 4 | A |
| E3-3 | Attachment upload (validation, local storage adapter) | 4 | A |
| E3-4 | `/report` formu (lokasyon seçici, foto) ve `/my-cases`, `/cases/[id]` | 4 | B/C |
| E3-5 | Yorumlar, geri bildirim, reopen | 8 | A (API) + B/C (ekran) |
| E4 | **Task & SLA** | | |
| E4-1 | Task modeli + case senkronizasyonu | 5 | A |
| E4-2 | SLA kural eşleşmesi, `due_at`, SLA status hesabı | 5 | A |
| E4-3 | `/staff/tasks`, `/staff/tasks/[id]` (kabul, başlat, kanıt, tamamla) | 5–8 | B/C |
| E5 | **AI Agent'lar** | | |
| E5-1 | BaseAgent, AgentResult, provider Protocol'leri, orchestrator iskeleti | 6 | A |
| E5-2 | Türkçe normalizasyon + Intake Agent | 6 | A |
| E5-3 | Sentetik veri üretici + eğitim/değerlendirme scriptleri + model v1 | 6 | A (+ B/C etiketleme) |
| E5-4 | Classification Agent (ML + kural + fallback) | 6 | A |
| E5-5 | Priority Agent (açıklanabilir skor) | 6 | A |
| E5-6 | Duplicate Agent | 7 | A |
| E5-7 | Verification + Routing Agent | 7 | A |
| E5-8 | Supervisor karar tablosu + autonomy policy + uygulama servisi | 7 | A |
| E5-9 | Manager review kuyruğu + override (`decision_feedback`) | 8 | A (API) + B/C (ekran) |
| E5-10 | Monitoring Agent (APScheduler + advisory lock) | 11 | A |
| E5-11 | Resolution Agent | 11 | Ortak |
| E5-12 | Analytics Summary Agent (şablon NLG + opsiyonel Ollama + sayı guard) | 11 | Ortak |
| E6 | **Analytics & Dashboard** | | |
| E6-1 | Demo seed: 500 geçmiş + 40 açık case, gömülü pattern'ler | 9 | A |
| E6-2 | KPI servisleri + testleri | 9 | A |
| E6-3 | Rapor endpoint'leri (trend, kategori, lokasyon, süre, SLA, aging, departman, recurring, süreç) | 9 | A |
| E6-4 | `/manager/dashboard`, `/manager/cases`, `/manager/analytics` | 10 | B/C |
| E6-5 | Agent metrikleri API + `/manager/agents` | 10 | A (API) + B/C (ekran) |
| E7 | **Kalite & Teslim** | | |
| E7-1 | Playwright E2E ana senaryo | 11 | B/C |
| E7-2 | Güvenlik kontrol listesi (IDOR, upload, CORS, rate limit) | 11 | A |
| E7-3a | **Staging** canlı ortamı: Vercel + Render + Neon; açılışta migration, `/api` yönlendirmesi; deploy GitHub entegrasyonuyla ([DEPLOYMENT.md](DEPLOYMENT.md) bölüm 1.1) | 4–5 | A ✅ |
| E7-3 | **Production** ortamı + `deploy-production.yml` (manuel onay), sürüm etiketi | 11 | A |
| E7-4 | Akademik deney raporu (RQ1–RQ5), tez tabloları/grafikleri | 12 | Hepsi |
| E7-5 | UI polish, demo senaryosu, sunum | 12 | Hepsi |
| E8 | **Tasarım (Figma)** — kodlamadan bir faz önce ilerler ([UI_GUIDE.md](UI_GUIDE.md)) | | |
| E8-1 | Figma dosyası: shadcn/ui kiti, token'lar (`globals.css` ile aynı adlar), durum/öncelik/SLA renkleri | 3 | B/C |
| E8-2 | Genel iskelet (menü, sayfa düzeni; mobil + masaüstü) + login | 3 | B/C |
| E8-3 | Reporter akışı: `/report` (mobil), onay ekranı, `/my-cases`, case detayı | 3–4 | B/C |
| E8-4 | Staff akışı: görev listesi ve görev detayı (mobil) | 4–5 | B/C |
| E8-5 | Manager: inceleme kuyruğu + AI karar gerekçe paneli, case listesi | 6–7 | B/C |
| E8-6 | Manager dashboard, analitik ve agent performans ekranları | 8–9 | B/C |
| E8-7 | Admin ekranları (tablo + form kalıbı) | 3 | B/C |

## 4. Sprint 1 Backlog (Hafta 2 — FAZ 1) — ✅ tamamlandı (PR #3)

> Bu tablo FAZ 1 planlamasındaki haliyle korunmuştur; sahip sütunu eski A/B/C dağılımını gösterir.

**Sprint hedefi:** Her geliştirici tek komutla (`docker compose up`) frontend + backend + Postgres'i
ayağa kaldırabilir, `/health` yeşil, CI her PR'da çalışır.

| # | İş | Sahip | Kabul kriteri |
|---|---|---|---|
| 1 | Repo'yu senkronize olmayan klasöre klonla, `main`/`develop` + branch protection | C | Direkt push reddediliyor |
| 2 | Monorepo klasörleri, `.gitignore`, `.env.example`, `.editorconfig` | C | Tree ARCHITECTURE §3 ile uyumlu |
| 3 | Backend iskeleti: `pyproject.toml` (uv), FastAPI app factory, config (pydantic-settings), logging, hata handler, `/api/v1/health` | A | `pytest` ile health testi geçer |
| 4 | SQLAlchemy 2 + Alembic, ilk migration: organizations, departments, locations, users | A | `alembic upgrade head` / `downgrade base` çalışır |
| 5 | Backend Dockerfile + compose servisi (hot reload) | C | `docker compose up` sonrası `/health` 200 + DB bağlı |
| 6 | Next.js iskeleti: TS strict, Tailwind, shadcn/ui, ESLint, Vitest; login sayfası taslağı; rol bazlı layout | B | `npm run lint && npm run typecheck && npm test` temiz |
| 7 | Frontend Dockerfile + compose servisi | B | `localhost:3000` açılır, backend health'i gösterir |
| 8 | `ci.yml`: backend (ruff, mypy, pytest + postgres), frontend (lint, tsc, vitest, build) | C | Örnek PR'da tüm job'lar yeşil |
| 9 | ~~PR şablonu, CODEOWNERS~~ (FAZ 0'da eklendi) | — | — |
| 9b | KOD_KURALLARI künyesindeki lint kurallarını ruff/ESLint config'ine işle + `check_ascii_comments.py` | C | Bilerek ihlal eden örnek dosyada CI kırmızı |
| 10 | `ai/` iskeleti + sentetik veri üretici için case type şablon taslağı | C | 11 case type için ≥ 10 şablon cümle |
| 11 | Anonim veri toplama formu (Google Form) taslağı — KVKK uyumlu, kişisel veri istemez | B/C | Form metni ekipçe onaylandı |

## 4b. Araç Notları (ileride değerlendirilecek)

| Ne | Ne zaman | Not |
|---|---|---|
| **Serena** (MCP, sembol bazlı kod gezinme) | FAZ 5–6, agent'lar eklenip kod tabanı büyüyünce | Claude'un büyük kodda fonksiyon/sınıf/referans bulmasını hızlandırır; küçük projede arka plan sunucusunun maliyeti faydasından fazla. Kurulum (kişisel Claude ayarı, repoya bir şey eklenmez): `claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project <repo yolu>` — kurmadan önce Serena'nın güncel kurulum sayfası kontrol edilir. |

## 5. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Gerçek etiketli veri azlığı | RQ1 zayıflar | Erken form, sentetik veri, test setini gerçek veriden tutmak |
| Kapsam şişmesi | Teslim gecikir | Faz sonu değerlendirmesi; "nice-to-have" listesi (foto AI doğrulama, çoklu task, departman bazlı manager) |
| Ücretsiz hosting kısıtları (uyku, RAM) | Staging kararsız, demo'da ilk açılış yavaş | Hafif model, embedding opsiyonel, SLA'nın okuma anında hesaplanması; staging erken (hafta 4–5) kurulur ki sorunlar son haftaya kalmasın; sunumdan önce servis uyandırılır |
| OneDrive senkronizasyonu | Yavaş build, kilitli dosya | Repo'yu `C:\dev` altına taşımak |
| Silo çalışma | Entegrasyon sorunları | OpenAPI'den tip üretimi, çapraz review, haftalık entegrasyon demosu |
| Backend + agent yükünün tek kişide (A) toplanması | Backend gecikirse frontend de bekler | Sözleşme önce (şema ilk gün); B/C veri etiketleme, E2E ve "Ortak" agent'ları üstlenir; kapsam şişerse nice-to-have listesine atılır |
| Figma tasarımı ile kodun ayrışması | Tasarım koda aynı çıkmaz | shadcn/ui Figma kiti + `globals.css` ile aynı token adları; UI_GUIDE kontrol listesi |
