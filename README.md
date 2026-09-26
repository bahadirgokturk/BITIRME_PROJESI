# CampusFlow AI

**AI Agent Destekli Akıllı Kampüs Olay, Görev, Süreç ve Karar Destek Platformu**

YBS bitirme projesi (3 kişi, ~12 hafta). Kampüste ortaya çıkan fiziksel/operasyonel problemler
(sabun bitmesi, projeksiyon arızası, su kaçağı…) bildirilir; yerel çalışan AI agent'lar bildirimi
analiz eder, sınıflandırır, önceliklendirir, yönlendirir, görev oluşturur ve SLA'yı izler.
Tüm süreç event log'a yazılır ve yönetici dashboard'unda KPI / karar destek olarak raporlanır.

> **Sıfır API maliyeti:** Agent'lar ücretli LLM API'si kullanmaz. Kural motoru + kendi eğittiğimiz
> scikit-learn modelleri + (opsiyonel) yerel Ollama ile çalışır. Detay: [docs/AGENTS.md](docs/AGENTS.md)

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Frontend | Next.js (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, Recharts |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, PostgreSQL 16 |
| AI | Python kural motoru, scikit-learn (TF-IDF + Logistic Regression), opsiyonel sentence-transformers & Ollama |
| DevOps | Docker Compose, GitHub Actions |

## Ekip Arkadaşları İçin Hızlı Başlangıç

Ayrıntılı rehber: **[docs/ONBOARDING.md](docs/ONBOARDING.md)** · Kod kuralları: **[KOD_KURALLARI.md](KOD_KURALLARI.md)**

### En kolay yol: Claude ile kurulum

Repoyu klonladıktan sonra klasörü Claude Code'da açıp şunu yazın:

> `docs/ONBOARDING.md` rehberine göre bilgisayarımı bu proje için hazırla. Önce ortam kontrol
> scriptini çalıştır, eksikleri tek tek göster ve düzeltmemde bana yardım et.

Claude, repo kökündeki `CLAUDE.md` ve `KOD_KURALLARI.md` dosyalarını otomatik okur; yazdırdığınız
kod bu kurallara uyar.

### 1. İlk kurulum (bir kez)

Git kimliğini ayarla (commit'lerde görünür):

```bash
git config --global user.name "Ad Soyad"
```

```bash
git config --global user.email "github-e-postan@example.com"
```

```bash
git config --global core.autocrlf false
```

Repoyu **OneDrive dışına** klonla ve klasöre gir:

```bash
git clone https://github.com/bahadirgokturk/BITIRME_PROJESI.git C:\dev\campusflow
```

```bash
cd C:\dev\campusflow
```

Ortamı kontrol et (Windows / macOS-Linux):

```bash
powershell -ExecutionPolicy Bypass -File scripts\check-setup.ps1
```

```bash
bash scripts/check-setup.sh
```

> Repoyu varsayılan branch `develop` olmadan önce klonladıysan bir kez `git fetch origin` ve
> `git checkout develop` çalıştır.

### 2. Her yeni iş için

```bash
git checkout develop
```

```bash
git pull
```

```bash
git checkout -b feature/kisa-aciklama
```

Kodla, test yaz, commit at (ör. `feat(cases): add case creation endpoint`), sonra:

```bash
git push -u origin feature/kisa-aciklama
```

GitHub'da **`develop`'a** Pull Request aç ve şablonu doldur. PR'ı **Bahadır onaylar**, onaydan sonra
**Squash and merge** yapılır. `main` ve `develop`'a doğrudan push yapılamaz.

### 3. Projeyi çalıştırma (FAZ 1 tamamlanınca)

```bash
docker compose up --build
```

Frontend: http://localhost:3000 · API dokümanı: http://localhost:8000/docs

## Dokümantasyon

| Doküman | İçerik |
|---|---|
| [CLAUDE.md](CLAUDE.md) | AI kod asistanları için proje özeti ve kurallar |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Mimari, katmanlar, repo ağacı, mimari kararlar (ADR) |
| [DATABASE.md](docs/DATABASE.md) | ER diyagramı, tablo şemaları, index'ler |
| [WORKFLOW.md](docs/WORKFLOW.md) | Case/Task state machine, RBAC matrisi |
| [AGENTS.md](docs/AGENTS.md) | Agent mimarisi, ücretsiz AI stratejisi, autonomy policy |
| [API.md](docs/API.md) | REST endpoint taslağı |
| [ANALYTICS.md](docs/ANALYTICS.md) | KPI tanımları ve formülleri, araştırma soruları |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Ortamlar, env dosyaları, Git workflow, CI/CD |
| [TESTING.md](docs/TESTING.md) | Test stratejisi |
| [CONVENTIONS.md](docs/CONVENTIONS.md) | Kodlama kuralları, Definition of Done |
| [PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | Fazlar, 12 haftalık backlog, Sprint 1 |

## Durum

FAZ 0 (mimari & planlama) tamamlandı. Kurulum talimatları FAZ 1'de eklenecek.
