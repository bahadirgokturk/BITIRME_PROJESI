# CLAUDE.md

Guidance for AI coding assistants (Claude Code and others) working in this repository.
Human contributors: this file is also a good 2-minute summary of the project.

## Project

**CampusFlow AI** — AI-agent-assisted campus incident, task, process and decision-support platform.
YBS (Management Information Systems) graduation project, 3-person team, ~12 weeks.
Full spec lives in `docs/`; start with `docs/ARCHITECTURE.md`.

## READ THIS FIRST — `KOD_KURALLARI.md`

**[KOD_KURALLARI.md](KOD_KURALLARI.md) is binding for every line of code.** Read it before writing code.
PRs that violate it are rejected. Most-broken rules:

| # | Rule | Short version |
|---|---|---|
| 1 | Fail fast | No empty `except:` / `catch {}`. Catch only narrow, expected errors with a concrete handling. |
| 2 | Few branches | Max 2 nesting levels. Guard clauses, dict/table lookups instead of if-chains. |
| 3 | English identifiers | Variables, functions, files, tables, endpoints: **English**. |
| 3 | Turkish comments, **ASCII only** | Comments/docstrings in Turkish without `ç ğ ı ö ş ü` (write `c g i o s u`). UI text keeps full Turkish. |
| 4 | TDD | Failing test first, then the code. Bug fix = failing test first. |
| 7 | No magic numbers | Thresholds/weights in `core/constants.py` or DB, with a comment giving the reason. |
| 13 | Layer boundaries | No business logic or SQL in routes/components; agents never touch the DB. |

## Stack

- **backend/** — FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, PostgreSQL 16, Python 3.12, `uv`, pytest, ruff, mypy
- **frontend/** — Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui, TanStack Query, Vitest, Playwright
- **ai/** — model training (scikit-learn TF-IDF + LogisticRegression), synthetic data generator, evaluation
- **No paid LLM APIs.** Agents = rule engine + our own trained ML models + optional local Ollama.
  The system must fully work with `LLM_PROVIDER=none`. See `docs/AGENTS.md`.
- **Not used (do not add):** microservices, Kafka, Kubernetes, Redis, Celery, LangChain/LangGraph.

## Architecture essentials

- Modular monolith. Backend layers: `api → services → repositories → models`; `agents/` and `analytics/` are called by services.
- Status changes only via `WorkflowService.transition()` using the `ALLOWED_TRANSITIONS` table (`docs/WORKFLOW.md`); every transition writes a `case_events` row in the same transaction.
- Agents take `AgentContext` (read-only data) and return `AgentResult` (decision, confidence, reasons, model); services persist them to `agent_decisions`.
- Supervisor is a deterministic decision table, not an LLM.
- Departments, case types and routing come from `docs/DEPARTMENTS.md` (sourced from the university's official
  duty descriptions). Change that table first; seeds and `ai/generators/templates/campus.yaml` follow it.
- Authorization: role dependency on routes + ownership checks in `services/authorization.py`; unauthorized resource access returns **404** (IDOR).
- Frontend API types are generated from the backend OpenAPI schema — never hand-write them.
- Frontend screens: use the project skill `.claude/skills/campusflow-screen` (Figma via MCP → screen). The frontend
  team sets up the Figma MCP themselves as a learning step — guide them, don't do it for them.
- UI work follows `docs/UI_GUIDE.md` (Figma → shadcn/ui, tokens, status colors, screen states). Contract first:
  backend publishes endpoint schemas early in each phase so frontend never waits (`docs/PROJECT_PLAN.md` §1).

## Workflow

- Branches: `main` (production), `develop` (staging), `feature/*`, `fix/*`, `chore/*` — always branch from `develop`.
- Never push directly to `main` or `develop`; open a PR to `develop`. Conventional Commits (`feat(cases): ...`).
- PRs to `develop` need no approval: once CI is green the author squash-merges. PRs to `main` (production)
  require approval from the owner @bahadirgokturk (CODEOWNERS). Never merge into `main` unless the user says so.
- Never deploy to production or run destructive migrations without explicit team approval.
- When code changes behaviour described in `docs/`, update the doc in the same PR.

## Helping a teammate set up or start work

Teammates use Claude Code to set up their machines. When asked to set up the environment:

1. Run `scripts/check-setup.ps1` (Windows) or `scripts/check-setup.sh` and show the result.
2. Walk through each FAIL/WARN using `docs/ONBOARDING.md`. Explain before running anything that
   installs software or changes global git config, and let the user confirm.
3. If the repo is inside OneDrive/Dropbox, recommend re-cloning to `C:\dev\campusflow`; never move or
   delete the user's folders yourself.
4. Make sure they are on `develop` (`git fetch origin` + `git checkout develop`) before any work.

When starting a new task: `git checkout develop` → `git pull` → `git checkout -b feature/<short-name>`.
Finish with a pushed branch and a PR to `develop`; the author merges it after CI is green.

**Opening the PR (pre-filled):** the team has no `gh` CLI, so give the user a compare link that opens the PR form
already filled in — never an empty template. Fill every section of `.github/pull_request_template.md` from the
actual work (what/why + backlog id, the YAML plan, type, real `pytest --co -q | tail -1` / `npm test` counts,
whether the new test was seen red first, checklist ticked only where true), in Turkish. Build the link as
`https://github.com/bahadirgokturk/BITIRME_PROJESI/compare/develop...<branch>?expand=1&title=<urlencoded>&body=<urlencoded>`
(Conventional Commit title). Keep it under ~7000 characters; if longer, print the body for pasting instead.
Explain git steps briefly in Turkish; the team is learning the workflow.

## Commands

DB + backend run in Docker; the frontend runs on the host (`npm run dev`) because Turbopack misses file events
on Windows/macOS bind mounts. `cp .env.example .env` first.

```bash
docker compose up --build -d                           # backend :8000 + postgres :5433 (host)
cd frontend && npm ci && npm run dev                   # frontend :3000 (env defaults: frontend/.env.development)
docker compose exec backend alembic upgrade head
docker compose exec backend python -m seeds.run --demo  # campus template + demo users (idempotent)
docker compose exec backend pytest                     # integration tests use a separate <db>_test database
docker compose exec backend sh -c "ruff check . && ruff format --check . && mypy"
docker compose exec backend alembic revision --autogenerate -m "..."   # then review + write downgrade
cd frontend && npm run lint && npm run typecheck && npm test
cd frontend && npm run gen:api                         # regenerate API types (backend must be running)
python scripts/check_ascii_comments.py backend ai frontend/src scripts
```

Seeds: `docker compose exec backend python -m seeds.run --demo` (idempotent; demo accounts in `backend/seeds/README.md`,
`--demo` refused in production). CI (`.github/workflows/ci.yml`) runs all of the above
plus an OpenAPI drift check (`api-contract` job) on every PR.
