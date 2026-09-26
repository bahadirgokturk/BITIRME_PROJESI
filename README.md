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

## Dokümantasyon

| Doküman | İçerik |
|---|---|
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
