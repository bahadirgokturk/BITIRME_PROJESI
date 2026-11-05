// Yonetim > Bildirim Turleri endpoint'lerinin sahte karsiliklari (cevrimdisi mod; gercek API E2-3).
// Tekrar eden kod backend ile ayni mesajla doner (core/messages.py DUPLICATE_CODE).
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type CaseType = Schemas["CaseTypeAdminRead"];

const SUPPORT = 1;
const MAINTENANCE = 2;
const IT_SUPPORT = 3;

function caseType(id: number, code: string, name: string, rest: Partial<CaseType>): CaseType {
  return {
    id,
    code,
    name,
    category: "OTHER",
    default_department_id: SUPPORT,
    secondary_department_id: null,
    base_priority: "LOW",
    base_severity: 20,
    is_safety_related: false,
    keywords: [],
    is_active: true,
    ...rest,
  };
}

// Kodlar ve birimler docs/DEPARTMENTS.md bolum 3'ten (seed ile ayni), kisaltilmis liste
const CASE_TYPES: CaseType[] = [
  caseType(1, "SOAP_EMPTY", "Sabun bitti", { category: "CONSUMABLE", keywords: ["sabun", "sabunluk", "el yıkama"] }),
  caseType(2, "AREA_DIRTY", "Alan kirli", {
    category: "CLEANING",
    base_priority: "MEDIUM",
    base_severity: 30,
    keywords: ["kirli", "pis", "koku"],
  }),
  caseType(3, "ELECTRICAL_FAILURE", "Elektrik arızası", {
    category: "TECHNICAL",
    default_department_id: MAINTENANCE,
    base_priority: "HIGH",
    base_severity: 70,
    is_safety_related: true,
    keywords: ["elektrik", "priz", "sigorta", "kıvılcım"],
  }),
  caseType(4, "NETWORK_OUTAGE", "İnternet kesintisi", {
    category: "IT",
    default_department_id: IT_SUPPORT,
    base_priority: "MEDIUM",
    base_severity: 40,
    keywords: ["internet", "wifi", "ağ"],
  }),
  caseType(5, "OUT_OF_SCOPE", "Kapsam dışı talep", { default_department_id: null, base_severity: 0 }),
  caseType(6, "LOST_ITEM", "Kayıp / bulunan eşya", { category: "SECURITY", keywords: ["kayıp", "bulundu"], is_active: false }),
];

let caseTypes: CaseType[] = [];

// Testler her seferinde ayni listeyle baslar
export function resetAdminCaseTypes(): void {
  caseTypes = structuredClone(CASE_TYPES);
}
resetAdminCaseTypes();

function error(status: number, code: string, message: string) {
  const body: Schemas["ErrorRead"] = { error: { code, message, details: {} } };
  return HttpResponse.json(body, { status });
}

// Gonderilmeyen alan degismez; birim alanlari null ile kaldirilir, digerlerinde null "degistirme" demektir
function applyUpdate(current: CaseType, body: Schemas["CaseTypeUpdate"]): CaseType {
  const kept = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== null && value !== undefined));
  return {
    ...current,
    ...kept,
    default_department_id:
      body.default_department_id === undefined ? current.default_department_id : body.default_department_id,
    secondary_department_id:
      body.secondary_department_id === undefined ? current.secondary_department_id : body.secondary_department_id,
  };
}

export const adminCaseTypeHandlers = [
  http.get(apiUrl("/admin/case-types"), () => HttpResponse.json({ items: caseTypes, total: caseTypes.length, page: 1 })),

  http.post<never, Schemas["CaseTypeCreate"]>(apiUrl("/admin/case-types"), async ({ request }) => {
    const body = await request.json();
    if (caseTypes.some((type) => type.code === body.code)) {
      return error(409, "CONFLICT", "Bu kod zaten kullanılıyor.");
    }
    const created = caseType(Math.max(...caseTypes.map((type) => type.id)) + 1, body.code, body.name, {
      ...body,
      default_department_id: body.default_department_id ?? null,
      secondary_department_id: body.secondary_department_id ?? null,
    });
    caseTypes.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch<{ id: string }, Schemas["CaseTypeUpdate"]>(apiUrl("/admin/case-types/:id"), async ({ request, params }) => {
    const id = Number(params.id);
    const current = caseTypes.find((type) => type.id === id);
    if (!current) {
      return error(404, "NOT_FOUND", "Kayıt bulunamadı.");
    }
    const updated = applyUpdate(current, await request.json());
    caseTypes = caseTypes.map((type) => (type.id === id ? updated : type));
    return HttpResponse.json(updated);
  }),
];
