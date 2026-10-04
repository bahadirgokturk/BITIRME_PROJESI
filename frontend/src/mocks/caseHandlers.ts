// FAZ 3 bildirim endpoint'lerinin sahte karsiliklari (cevrimdisi mod; gercek API E3-1).
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { CASES, EMPTY_CASE, timelineFor } from "./caseFixtures";
import { LOCATIONS, USERS } from "./fixtures";
import { MANAGER_CASES } from "./managerCaseFixtures";
import { TASKS } from "./taskFixtures";
import { taskEventsFor } from "./taskHandlers";

type Schemas = components["schemas"];

// Backend ile ayni sinir: backend/app/core/constants.py CASE_DESCRIPTION_MIN_LENGTH
const DESCRIPTION_MIN_LENGTH = 10;
const TITLE_FROM_DESCRIPTION_LENGTH = 60;
const CASE_NUMBER_DIGITS = 6;
// Backend ile ayni: backend/app/core/constants.py PAGE_SIZE_DEFAULT
const PAGE_SIZE_DEFAULT = 20;

// Oturum boyunca olusturulan bildirimler burada tutulur; sayfa yenilenince sifirlanir
const cases: Schemas["CaseRead"][] = [...CASES];

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1 };
}

// Backend ile ayni kural (backend/app/services/case_service.py title_from): kelime ortasindan kesilmez
const TITLE_TRAILING = /[\s,;:.-]+$/;

function titleFrom(description: string): string {
  const text = description.trim().split(/\s+/).join(" ");
  if (text.length <= TITLE_FROM_DESCRIPTION_LENGTH) {
    return text;
  }
  const window = text.slice(0, TITLE_FROM_DESCRIPTION_LENGTH + 1);
  const space = window.lastIndexOf(" ");
  const head = space > 0 ? window.slice(0, space) : text.slice(0, TITLE_FROM_DESCRIPTION_LENGTH);
  return `${head.replace(TITLE_TRAILING, "")}…`;
}

export function findCase(id: string | readonly string[] | undefined) {
  return [...cases, ...MANAGER_CASES].find((item) => String(item.id) === id);
}

const fold = (text: string) => text.toLocaleLowerCase("tr");

// q: numara, baslik ya da konum adinda gecen metin
function matchesSearch(item: Schemas["CaseRead"], search: string | null): boolean {
  if (!search) {
    return true;
  }
  return [item.case_number, item.title, item.location.name].some((text) => fold(text).includes(fold(search)));
}

function matches(item: Schemas["CaseRead"], params: URLSearchParams): boolean {
  const statuses = params.getAll("status");
  const priority = params.get("priority");
  const sla = params.get("sla_status");
  return (
    (statuses.length === 0 || statuses.includes(item.status)) &&
    (!priority || item.priority === priority) &&
    (!sla || item.sla_status === sla) &&
    matchesSearch(item, params.get("q"))
  );
}

function newCase(
  body: Schemas["CaseCreate"],
  location: Schemas["LocationRead"],
): Schemas["CaseRead"] {
  // Personel gorevlerinin bildirim numaralari da dolu sayilir: yeni bildirim onlarla cakismasin
  const used = [...cases.map((item) => item.id), ...TASKS.map((task) => task.case_id)];
  const id = Math.max(...used) + 1;
  return {
    ...EMPTY_CASE,
    id,
    case_number: `CASE-${String(id).padStart(CASE_NUMBER_DIGITS, "0")}`,
    title: body.title ?? titleFrom(body.description),
    description: body.description,
    location: {
      id: location.id,
      kind: location.kind,
      name: location.name,
      path: location.path,
    },
    status: "ANALYZING",
    reporter_id: USERS.REPORTER.id,
    needs_human_review: false,
    created_at: new Date().toISOString(),
  };
}

export const caseHandlers = [
  http.get(apiUrl("/locations"), () =>
    HttpResponse.json(
      page(
        LOCATIONS.map(
          ({ importance_weight: _w, is_active: _a, ...option }) => option,
        ),
      ),
    ),
  ),

  http.post<never, Schemas["CaseCreate"]>(
    apiUrl("/cases"),
    async ({ request }) => {
      const body = await request.json();
      const location = LOCATIONS.find((item) => item.id === body.location_id);
      if (
        (body.description ?? "").trim().length < DESCRIPTION_MIN_LENGTH ||
        !location
      ) {
        return error(422, "VALIDATION_ERROR", "Gönderilen veriler geçersiz.");
      }
      const created = newCase(body, location);
      cases.unshift(created);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.get(apiUrl("/cases/mine"), () =>
    HttpResponse.json(
      page(cases.filter((item) => item.reporter_id === USERS.REPORTER.id)),
    ),
  ),

  // Mudur listesi (/manager/cases): gercek API'deki suzgecler ve sayfalama (docs/API.md "Cases")
  http.get(apiUrl("/cases"), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const items = [...MANAGER_CASES, ...cases].filter((item) => matches(item, params));
    const pageNumber = Number(params.get("page") ?? 1);
    const size = Number(params.get("page_size") ?? PAGE_SIZE_DEFAULT);
    const start = (pageNumber - 1) * size;
    return HttpResponse.json({ items: items.slice(start, start + size), total: items.length, page: pageNumber });
  }),

  http.get(apiUrl("/cases/:id"), ({ params }) => {
    const item = findCase(params.id);
    return item
      ? HttpResponse.json(item)
      : error(404, "NOT_FOUND", "Kayıt bulunamadı.");
  }),

  http.get(apiUrl("/cases/:id/events"), ({ params }) => {
    const item = findCase(params.id);
    // Personel gorevlerinin bildirimleri bu sahte listede olmayabilir; olaylari taskHandlers.ts tutar
    const taskEvents = taskEventsFor(Number(params.id));
    if (!item && !taskEvents) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    return HttpResponse.json([...(item ? timelineFor(item) : []), ...(taskEvents ?? [])]);
  }),
];
