# PROJECT PLAN — CampusFlow AI

## 1. Ekip ve Sorumluluklar

| Kişi | Ana sorumluluk | Yedek (review) alanı |
|---|---|---|
| **A** | Backend, case engine, workflow, agent orchestrator | Analytics backend |
| **B** | Frontend, UX, staff/reporter ekranları, manager dashboard | API sözleşmesi, E2E |
| **C** | AI/ML (veri, eğitim, sınıflandırma, duplicate), analytics, DevOps/CI, test altyapısı | Agent'lar |

Kural: Her kişi haftada en az 1 PR'ı **kendi alanı dışında** review eder. Haftalık 30 dk demo + planlama.

## 2. Fazlar ve Haftalar

| Hafta | Faz | Çıktı (demo edilebilir) |
|---|---|---|
| 1 | FAZ 0 | Mimari, ERD, RBAC, state machine, backlog (**bu doküman seti**) |
| 2 | FAZ 1 | Monorepo, Docker Compose, FastAPI + Next.js iskeleti, Postgres + Alembic, CI pipeline |
| 3 | FAZ 2 | Auth (JWT), RBAC, admin: kullanıcı/departman/lokasyon; campus template seed |
| 4 | FAZ 3 | Case oluşturma, state machine, event log, reporter ekranları (`/report`, `/my-cases`) |
| 5 | FAZ 4 | Task yönetimi, SLA engine (due_at, SLA status), staff ekranları taslağı |
| 6 | FAZ 5 | Intake + Classification (kural + TF-IDF/LR v1) + Priority; sentetik veri üretici |
| 7 | FAZ 6 | Duplicate, Verification, Routing, Supervisor; orchestrator; `agent_decisions` |
| 8 | FAZ 7 | Staff lifecycle tamam, case detay zaman çizelgesi, manager review kuyruğu + override |
| 9 | FAZ 8 | Analytics backend (tüm KPI + raporlar), 500+ case demo seed'i |
| 10 | FAZ 9–10 | Manager dashboard, analytics sayfası, agent performans dashboard'u |
| 11 | FAZ 11 + 12 | Monitoring, Resolution, AI yönetim özeti; E2E, güvenlik kontrolü, bug fix |
| 12 | FAZ 12 | UI polish, dokümantasyon, akademik deney sonuçları, sunum + demo provası |

**Paralel iş kolu (C):** Hafta 2–3'te anonim veri toplama formu yayınlanır, hafta 4–5 etiketleme
(2 kişi bağımsız + kappa), hafta 6'da model v1, hafta 10'da feedback ile model v2 karşılaştırması.

## 3. 12 Haftalık Backlog (Epic → Story)

| ID | Epic / Story | Hafta | Sahip |
|---|---|---|---|
| E1 | **Altyapı** | | |
| E1-1 | Monorepo iskeleti, `.gitignore`, `.env.example`, README | 2 | C |
| E1-2 | Docker Compose (frontend, backend, postgres) + healthcheck | 2 | C |
| E1-3 | FastAPI iskeleti (katmanlar, config, logging, hata handler, `/health`) | 2 | A |
| E1-4 | SQLAlchemy + Alembic, ilk migration (organizations, departments, locations, users) | 2 | A |
| E1-5 | Next.js iskeleti (Tailwind, shadcn, layout, rol bazlı menü, API client) | 2 | B |
| E1-6 | GitHub Actions CI (lint, typecheck, test), branch protection, PR şablonu | 2 | C |
| E2 | **Kimlik & Yönetim** | | |
| E2-1 | Login/refresh/logout, argon2, JWT | 3 | A |
| E2-2 | RBAC dependency + ownership yardımcıları + testleri | 3 | A |
| E2-3 | Admin CRUD: users, departments, locations (hiyerarşi), case types, SLA, agent policies | 3–4 | A/B |
| E2-4 | Campus template seed (YAML → DB, idempotent) | 3 | C |
| E2-5 | Audit log | 4 | A |
| E3 | **Case Yönetimi** | | |
| E3-1 | Case modeli, case_number sequence, oluşturma API'si | 4 | A |
| E3-2 | WorkflowService + transition tablosu + event yazımı (%100 test) | 4 | A |
| E3-3 | Attachment upload (validation, local storage adapter) | 4 | C |
| E3-4 | `/report` formu (lokasyon seçici, foto) ve `/my-cases`, `/cases/[id]` | 4 | B |
| E3-5 | Yorumlar, geri bildirim, reopen | 8 | A/B |
| E4 | **Task & SLA** | | |
| E4-1 | Task modeli + case senkronizasyonu | 5 | A |
| E4-2 | SLA kural eşleşmesi, `due_at`, SLA status hesabı | 5 | C |
| E4-3 | `/staff/tasks`, `/staff/tasks/[id]` (kabul, başlat, kanıt, tamamla) | 5–8 | B |
| E5 | **AI Agent'lar** | | |
| E5-1 | BaseAgent, AgentResult, provider Protocol'leri, orchestrator iskeleti | 6 | A |
| E5-2 | Türkçe normalizasyon + Intake Agent | 6 | C |
| E5-3 | Sentetik veri üretici + eğitim/değerlendirme scriptleri + model v1 | 6 | C |
| E5-4 | Classification Agent (ML + kural + fallback) | 6 | C |
| E5-5 | Priority Agent (açıklanabilir skor) | 6 | A |
| E5-6 | Duplicate Agent | 7 | C |
| E5-7 | Verification + Routing Agent | 7 | A |
| E5-8 | Supervisor karar tablosu + autonomy policy + uygulama servisi | 7 | A |
| E5-9 | Manager review kuyruğu + override (`decision_feedback`) | 8 | A/B |
| E5-10 | Monitoring Agent (APScheduler + advisory lock) | 11 | A |
| E5-11 | Resolution Agent | 11 | A |
| E5-12 | Analytics Summary Agent (şablon NLG + opsiyonel Ollama + sayı guard) | 11 | C |
| E6 | **Analytics & Dashboard** | | |
| E6-1 | Demo seed: 500 geçmiş + 40 açık case, gömülü pattern'ler | 9 | C |
| E6-2 | KPI servisleri + testleri | 9 | C |
| E6-3 | Rapor endpoint'leri (trend, kategori, lokasyon, süre, SLA, aging, departman, recurring, süreç) | 9 | C/A |
| E6-4 | `/manager/dashboard`, `/manager/cases`, `/manager/analytics` | 10 | B |
| E6-5 | Agent metrikleri API + `/manager/agents` | 10 | C/B |
| E7 | **Kalite & Teslim** | | |
| E7-1 | Playwright E2E ana senaryo | 11 | B |
| E7-2 | Güvenlik kontrol listesi (IDOR, upload, CORS, rate limit) | 11 | A |
| E7-3 | Staging + production deploy pipeline | 11 | C |
| E7-4 | Akademik deney raporu (RQ1–RQ5), tez tabloları/grafikleri | 12 | C |
| E7-5 | UI polish, demo senaryosu, sunum | 12 | Hepsi |

## 4. Sprint 1 Backlog (Hafta 2 — FAZ 1)

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
| 9 | ~~PR şablonu~~ (FAZ 0'da eklendi), CODEOWNERS (ekip GitHub kullanıcı adlarıyla) | C | CODEOWNERS reviewer'ı otomatik atıyor |
| 9b | KOD_KURALLARI künyesindeki lint kurallarını ruff/ESLint config'ine işle + `check_ascii_comments.py` | C | Bilerek ihlal eden örnek dosyada CI kırmızı |
| 10 | `ai/` iskeleti + sentetik veri üretici için case type şablon taslağı | C | 11 case type için ≥ 10 şablon cümle |
| 11 | Anonim veri toplama formu (Google Form) taslağı — KVKK uyumlu, kişisel veri istemez | B/C | Form metni ekipçe onaylandı |

## 5. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Gerçek etiketli veri azlığı | RQ1 zayıflar | Erken form, sentetik veri, test setini gerçek veriden tutmak |
| Kapsam şişmesi | Teslim gecikir | Faz sonu değerlendirmesi; "nice-to-have" listesi (foto AI doğrulama, çoklu task, departman bazlı manager) |
| Ücretsiz hosting kısıtları (uyku, RAM) | Staging kararsız | Hafif model, embedding opsiyonel, SLA'nın okuma anında hesaplanması |
| OneDrive senkronizasyonu | Yavaş build, kilitli dosya | Repo'yu `C:\dev` altına taşımak |
| Silo çalışma | Entegrasyon sorunları | OpenAPI'den tip üretimi, çapraz review, haftalık entegrasyon demosu |
