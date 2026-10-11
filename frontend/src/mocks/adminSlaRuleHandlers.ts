// Yonetim > Sure Hedefleri endpoint'lerinin sahte karsiliklari (cevrimdisi mod; gercek API E2-3).
// Hata mesajlari backend ile ayni (core/messages.py DUPLICATE_SLA_RULE, INVALID_SLA_TARGETS).
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type SlaRule = Schemas["SlaRuleRead"];

// adminCaseTypeHandlers.ts'teki tur numaralari
const SOAP_EMPTY = 1;
const ELECTRICAL_FAILURE = 3;
const LOST_ITEM = 6;
const WARNING_DEFAULT = 75;

function slaRule(id: number, case_type_id: number | null, priority: SlaRule["priority"], minutes: [number, number]): SlaRule {
  return {
    id,
    case_type_id,
    priority,
    response_minutes: minutes[0],
    resolution_minutes: minutes[1],
    warning_threshold_pct: WARNING_DEFAULT,
    is_active: true,
  };
}

// Sureler backend/seeds/templates/campus/sla_rules.yaml ile ayni (kisaltilmis liste)
const SLA_RULES: SlaRule[] = [
  slaRule(1, null, "LOW", [240, 1440]),
  slaRule(2, null, "MEDIUM", [120, 480]),
  slaRule(3, null, "HIGH", [30, 240]),
  slaRule(4, null, "CRITICAL", [15, 60]),
  slaRule(5, SOAP_EMPTY, "LOW", [60, 240]),
  slaRule(6, ELECTRICAL_FAILURE, "HIGH", [15, 120]),
  { ...slaRule(7, LOST_ITEM, "LOW", [240, 2880]), is_active: false },
];

let slaRules: SlaRule[] = [];

// Testler her seferinde ayni listeyle baslar
export function resetAdminSlaRules(): void {
  slaRules = structuredClone(SLA_RULES);
}
resetAdminSlaRules();

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

const invalidTargets = () => error(422, "INVALID_SLA_TARGETS", "Çözüm süresi, kabul süresinden kısa olamaz.");

export const adminSlaRuleHandlers = [
  http.get(apiUrl("/admin/sla-rules"), () => HttpResponse.json({ items: slaRules, total: slaRules.length, page: 1 })),

  http.post<never, Schemas["SlaRuleCreate"]>(apiUrl("/admin/sla-rules"), async ({ request }) => {
    const body = await request.json();
    const typeId = body.case_type_id ?? null;
    if (slaRules.some((rule) => rule.case_type_id === typeId && rule.priority === body.priority)) {
      return error(409, "CONFLICT", "Bu bildirim türü ve öncelik için zaten bir SLA kuralı var.");
    }
    if (body.resolution_minutes < body.response_minutes) {
      return invalidTargets();
    }
    const created: SlaRule = {
      ...slaRule(Math.max(...slaRules.map((rule) => rule.id)) + 1, typeId, body.priority, [
        body.response_minutes,
        body.resolution_minutes,
      ]),
      warning_threshold_pct: body.warning_threshold_pct,
    };
    slaRules.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch<{ id: string }, Schemas["SlaRuleUpdate"]>(apiUrl("/admin/sla-rules/:id"), async ({ request, params }) => {
    const id = Number(params.id);
    const current = slaRules.find((rule) => rule.id === id);
    if (!current) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    const body = await request.json();
    const updated: SlaRule = {
      ...current,
      response_minutes: body.response_minutes ?? current.response_minutes,
      resolution_minutes: body.resolution_minutes ?? current.resolution_minutes,
      warning_threshold_pct: body.warning_threshold_pct ?? current.warning_threshold_pct,
      is_active: body.is_active ?? current.is_active,
    };
    if (updated.resolution_minutes < updated.response_minutes) {
      return invalidTargets();
    }
    slaRules = slaRules.map((rule) => (rule.id === id ? updated : rule));
    return HttpResponse.json(updated);
  }),
];
