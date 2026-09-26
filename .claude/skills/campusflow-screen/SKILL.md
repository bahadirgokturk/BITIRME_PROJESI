---
name: campusflow-screen
description: Build or change a CampusFlow AI frontend screen or component — from a Figma frame (via the Figma MCP server), a screenshot, a sketch, or a description — following docs/UI_GUIDE.md, shadcn/ui, the MSW mock API and the project's test rules. Use whenever a teammate asks to make, design, implement, fix or polish a page, form, table, card or menu in frontend/, especially when they point at a Figma frame or paste its image.
---

# CampusFlow screen builder

The people using this skill are learning. Talk to them in **simple Turkish**, explain each step in one or two
sentences before doing it, and never leave them with a half-working screen. Code identifiers stay English;
code comments are Turkish **ASCII only** (KOD_KURALLARI rule 3); UI text is full Turkish.

## 0. Before touching code

1. Make sure they are on a fresh branch: `git checkout develop` → `git pull` → `git checkout -b feature/<screen-name>`.
   If they are already on a feature branch with unrelated work, stop and ask.
2. Read, in this order: `docs/UI_GUIDE.md` (sections 1, 2, 4, 5 for their role, 7, 8), `frontend/README.md`,
   `KOD_KURALLARI.md` rules 1, 2, 4, 13. `frontend/AGENTS.md` says Next.js 16 differs from your training data —
   check `frontend/node_modules/next/dist/docs/` before using any Next API you are unsure about.
3. Pin down, and ask if unclear: **route** (e.g. `/admin/departments`), **which role(s)** see it,
   **main device** (UI_GUIDE §2: reporter/staff = mobile first, manager/admin = desktop first),
   **what data** it shows and **what the main action** is.

## 1. Reading the Figma design

**Preferred: the Figma MCP server.** The team connects Figma's official MCP server to Claude Code themselves —
setting it up is part of their learning, so do not do it for them. If the Figma MCP tools are not available in
this session, say so, point them to Figma's own MCP setup guide, and offer to wait. Only if they explicitly say
they want to continue without it, fall back to a **screenshot** (PNG export of the frame).

With the MCP connected, read the selected frame's structure, variables and component names from Figma instead of
guessing from pixels. Either way:

- List the parts top to bottom (header, filters, table, form fields, buttons, empty/error text).
- Map every part to an existing **shadcn/ui** component (`frontend/src/components/ui/`). If one is missing,
  add it with `npx shadcn@latest add <name>` (run inside `frontend/`) — never hand-copy component code.
- Map colors to the **tokens** in `frontend/src/app/globals.css` (`primary`, `muted`, `destructive`, `border`…)
  — never paste hex values. Map spacing to the Tailwind 4 px scale (4, 8, 12, 16, 24, 32, 48).
- Say what you could not read from the design (exact color, hidden states, hover) and ask, rather than invent.
- If a Figma color or spacing does not match any token, tell the teammate — the Figma file should be fixed to
  use the tokens (UI_GUIDE §4), not the code.
- If the design lacks loading / empty / error states, design them from UI_GUIDE §7 and tell the teammate
  so they can add those frames to Figma.

## 2. Data: only what the API really has

- Look up the endpoint and schema in `frontend/src/lib/api/types.ts` (generated — **never edit by hand**;
  refresh with `npm run gen:api` while the backend runs).
- If the screen needs a field or endpoint that is **not** in the types: do not invent it. Tell the teammate to
  ask Bahadır (backend) and write the exact need (endpoint, field, type) so it can go into the contract.
- If the endpoint exists but the backend still returns `501`, make sure `frontend/src/mocks/handlers.ts` has a
  handler for it, with typed data in `frontend/src/mocks/fixtures.ts` (`components["schemas"]["..."]`).

## 3. Test first (KOD_KURALLARI rule 4)

Write the test before the component, run it, and **show the teammate it is red**, then make it green.
Follow the existing examples: `src/components/system/HealthStatus.test.tsx`, `src/hooks/useCurrentUser.test.tsx`.

- Wrap renders in `QueryClientProvider` with `createQueryClient()` from `@/lib/queryClient`.
- The MSW server from `vitest.setup.ts` already serves the mock handlers; use `server.use(...)` for error cases.
- Cover at least: data shown, empty state, error state (backend error envelope), and the main action.
- Query by role and label (`getByRole("button", { name: "Kaydet" })`), not by CSS class.

## 4. Build it

- Data hook in `src/hooks/useX.ts` (TanStack Query + `apiGet<...>` from `@/lib/api/client`).
- Page in `src/app/(app)/<route>/page.tsx`; pieces in `src/components/<area>/`.
- No business logic in components: mappings and calculations go to `src/lib/*.ts` as pure functions with tests
  (e.g. status → label/color belongs in `src/lib/status.ts`).
- Every screen has loading (skeleton), empty (text + next step), error (message + "Tekrar dene"), success states.
  An error must never render as an empty list (KOD_KURALLARI rule 1).
- Accessibility (UI_GUIDE §8): visible labels on every field, touch targets ≥ 44 px, focus ring visible,
  status shown with text as well as color.
- Role-based menu changes go through `src/lib/navigation.ts` only.
- Do not add npm packages without asking the teammate (and explain why it is needed).

## 5. Check it really works

1. `npm run lint && npm run typecheck && npm test` inside `frontend/` — all green.
2. With `npm run dev` running, open the page; check it at **375 px** and **1440 px** width and compare with
   the Figma frame. Describe the differences honestly and fix or list them.
3. To see another role's view, set `NEXT_PUBLIC_MOCK_ROLE` in `frontend/.env.local` and restart `npm run dev`.

## 6. Finish

Commit with a Conventional Commit message (`feat(admin): add departments table`), push, and give the
**pre-filled PR link** described in the root `CLAUDE.md` (template filled from the real work, real test counts,
note that screenshots at desktop and mobile width should be attached). Remind the teammate to attach the two
screenshots and to merge only after CI is green.

## Never

- Edit anything under `backend/` or the generated `src/lib/api/types.ts` by hand.
- Hard-code colors, invent API fields, or leave a screen without error/empty states.
- Commit to `develop` or `main` directly, or skip the red-test step.
