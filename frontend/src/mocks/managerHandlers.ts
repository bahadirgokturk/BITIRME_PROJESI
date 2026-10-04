// Manager inceleme kuyrugu ve duzeltme sozluklerinin sahte karsiliklari (cevrimdisi mod; gercek API E5-9).
// Sahte API her istegi gecerli sayar; rol kurallarini (MANAGER) yalniz gercek backend denetler.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { CASE_TYPE_OPTIONS, DECISIONS, DEPARTMENT_OPTIONS, REVIEW_ITEMS } from "./managerFixtures";

type Schemas = components["schemas"];
type CaseStatus = Schemas["CaseStatus"];

const PRIORITIES: readonly Schemas["Priority"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

let queue: Schemas["ReviewItemRead"][] = [];

// Testler her seferinde ayni kuyrukla baslar (islemler kuyruktan kayit cikarir)
export function resetReviewQueue(): void {
  queue = structuredClone(REVIEW_ITEMS);
}
resetReviewQueue();

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

function find(id: string | readonly string[] | undefined) {
  return queue.find((item) => String(item.case.id) === id);
}

// Islem sonrasi bildirim kuyruktan cikar ve yeni durumuyla doner
function resolve(id: string | readonly string[] | undefined, status: CaseStatus) {
  const item = find(id);
  if (!item) {
    return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
  }
  queue = queue.filter((other) => other !== item);
  return HttpResponse.json({ ...item.case, status });
}

const reasonMissing = () => error(422, "VALIDATION_ERROR", "Gerekçe zorunludur.");
const invalidValue = () => error(422, "INVALID_OVERRIDE_VALUE", "Geçersiz düzeltme değeri.");

// Backend gibi: tur ve birim koduyla, oncelik enum degeriyle duzeltilir; bilinmeyen deger reddedilir
const OVERRIDES: Record<Schemas["OverrideField"], (target: Schemas["CaseRead"], value: string) => boolean> = {
  priority: (target, value) => {
    const priority = PRIORITIES.find((item) => item === value);
    target.priority = priority ?? target.priority;
    return priority !== undefined;
  },
  case_type: (target, value) => {
    const type = CASE_TYPE_OPTIONS.find((item) => item.code === value);
    target.case_type = type ? { id: type.id, code: type.code, name: type.name } : target.case_type;
    target.category = type?.category ?? target.category;
    return type !== undefined;
  },
  department: (target, value) => {
    const department = DEPARTMENT_OPTIONS.find((item) => item.code === value);
    target.department = department ?? target.department;
    return department !== undefined;
  },
};

function applyOverride(target: Schemas["CaseRead"], body: Schemas["OverrideRequest"]): boolean {
  return OVERRIDES[body.field](target, body.corrected_value);
}

function withReason(status: CaseStatus) {
  return async ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
    const body = (await request.json()) as { reason?: string };
    return (body.reason ?? "").trim() === "" ? reasonMissing() : resolve(params.id, status);
  };
}

export const managerHandlers = [
  http.get(apiUrl("/manager/review-queue"), () =>
    HttpResponse.json({ items: queue, total: queue.length, page: 1 }),
  ),

  http.get(apiUrl("/cases/:id/decisions"), ({ params }) => HttpResponse.json(DECISIONS[Number(params.id)] ?? [])),

  http.post(apiUrl("/cases/:id/assign"), ({ params }) => resolve(params.id, "ASSIGNED")),

  http.get(apiUrl("/case-types"), () => HttpResponse.json(CASE_TYPE_OPTIONS)),
  http.get(apiUrl("/departments"), () => HttpResponse.json(DEPARTMENT_OPTIONS)),

  http.post<{ id: string }, Schemas["OverrideRequest"]>(apiUrl("/cases/:id/override"), async ({ request, params }) => {
    const body = await request.json();
    const item = find(params.id);
    if (!item) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    if (body.reason.trim() === "") {
      return reasonMissing();
    }
    return applyOverride(item.case, body) ? HttpResponse.json(item.case) : invalidValue();
  }),

  http.post(apiUrl("/cases/:id/reject"), withReason("REJECTED")),
  http.post(apiUrl("/cases/:id/merge"), withReason("MERGED")),
  http.post(apiUrl("/cases/:id/close"), withReason("CLOSED")),
];
