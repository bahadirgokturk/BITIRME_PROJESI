# frontend/ — Next.js (App Router)

Stil ve kurallar: [KOD_KURALLARI.md](../KOD_KURALLARI.md), [docs/CONVENTIONS.md](../docs/CONVENTIONS.md).
Next.js 16 kullanılıyor; API'ler eski sürümlerden farklı olabilir — `node_modules/next/dist/docs/` (bkz. `AGENTS.md`).

```bash
npm ci
npm run dev          # http://localhost:3000 (Docker dışında)
npm run lint
npm run typecheck
npm test
npm run gen:api      # backend çalışırken OpenAPI'den src/lib/api/types.ts üretir (elle düzenlenmez)
```

| Klasör | İçerik |
|---|---|
| `src/app/` | Sayfalar: `(app)/` menülü alan, `(auth)/login` |
| `src/components/ui/` | shadcn/ui bileşenleri |
| `src/components/layout/` | `AppShell` (rol bazlı menü) |
| `src/lib/` | API istemcisi, üretilmiş tipler, saf yardımcılar (`navigation.ts`, `health.ts`) |
| `src/hooks/` | TanStack Query hook'ları |
