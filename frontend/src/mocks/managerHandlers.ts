// Manager inceleme kuyrugu endpoint'lerinin sahte karsiliklari (cevrimdisi mod; gercek API E5-9).
// Sahte API her istegi gecerli sayar; rol kurallarini (MANAGER) yalniz gercek backend denetler.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import { DECISIONS, REVIEW_ITEMS } from "./managerFixtures";

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

  // Sahte modda yalniz oncelik duzeltilir; tur/birim icin manager'a acik liste endpoint'i henuz yok
  http.post<{ id: string }, Schemas["OverrideRequest"]>(apiUrl("/cases/:id/override"), async ({ request, params }) => {
    const body = await request.json();
    const item = find(params.id);
    if (!item) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    if (body.field !== "priority" || !PRIORITIES.includes(body.corrected_value as Schemas["Priority"])) {
      return error(422, "INVALID_OVERRIDE_VALUE", "Geçersiz düzeltme değeri.");
    }
    if (body.reason.trim() === "") {
      return reasonMissing();
    }
    item.case.priority = body.corrected_value as Schemas["Priority"];
    return HttpResponse.json(item.case);
  }),

  http.post(apiUrl("/cases/:id/reject"), withReason("REJECTED")),
  http.post(apiUrl("/cases/:id/merge"), withReason("MERGED")),
  http.post(apiUrl("/cases/:id/close"), withReason("CLOSED")),
];
