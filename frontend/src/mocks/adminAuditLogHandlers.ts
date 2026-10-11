// Yonetim > Islem Kayitlari endpoint'inin sahte karsiligi (cevrimdisi mod; gercek API E2-5).
// Guncellemede before/after yalniz degisen alanlari, eklemede after tam kaydi tasir (backend/app/services/audit.py).
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type AuditLog = Schemas["AuditLogRead"];
type Values = AuditLog["after"];

const ADMIN = { actor_id: 4, actor_name: "Sistem Yöneticisi", ip_address: "10.0.0.5" };
const DEFAULT_PAGE_SIZE = 50;

interface Entry {
  action: string;
  entity: [AuditLog["entity_type"], number];
  at: string;
  before: Values;
  after: Values;
}

// Kayit numaralari diger sahte listelerle ayni (birim 4 = Beslenme, tur 3 = Elektrik arizasi, kural 6 = onun kurali)
const ENTRIES: Entry[] = [
  { action: "SLA_RULE_UPDATED", entity: ["SLA_RULE", 6], at: "2026-10-12T11:32:00Z", before: { resolution_minutes: 120 }, after: { resolution_minutes: 180 } },
  {
    action: "CASE_TYPE_CREATED",
    entity: ["CASE_TYPE", 4],
    at: "2026-10-12T11:10:00Z",
    before: null,
    after: { id: 4, code: "NETWORK_OUTAGE", name: "İnternet kesintisi", category: "IT", default_department_id: 3, base_priority: "MEDIUM", keywords: ["internet", "wifi"], is_active: true },
  },
  {
    action: "AGENT_POLICY_UPDATED",
    entity: ["AGENT_POLICY", 1],
    at: "2026-10-12T10:55:00Z",
    before: { autonomy_level: "L1_AUTONOMOUS", min_confidence_auto: 0.7 },
    after: { autonomy_level: "L2_NOTIFY", min_confidence_auto: 0.85 },
  },
  { action: "DEPARTMENT_UPDATED", entity: ["DEPARTMENT", 4], at: "2026-10-12T08:20:00Z", before: { is_active: true }, after: { is_active: false } },
  { action: "USER_UPDATED", entity: ["USER", 2], at: "2026-10-11T13:05:00Z", before: { role: "STAFF" }, after: { role: "MANAGER" } },
  { action: "SLA_RULE_UPDATED", entity: ["SLA_RULE", 6], at: "2026-10-03T07:15:00Z", before: { warning_threshold_pct: 75 }, after: { warning_threshold_pct: 70 } },
  {
    action: "SLA_RULE_CREATED",
    entity: ["SLA_RULE", 6],
    at: "2026-09-28T06:02:00Z",
    before: null,
    after: { id: 6, case_type_id: 3, priority: "HIGH", response_minutes: 15, resolution_minutes: 120, warning_threshold_pct: 75, is_active: true },
  },
  // Listede olmayan kayit: ad, kaydin kendi icinden okunur
  { action: "LOCATION_CREATED", entity: ["LOCATION", 99], at: "2026-09-20T06:48:00Z", before: null, after: { id: 99, code: "B-3", name: "B Blok 3. Kat", kind: "FLOOR", is_active: true } },
];

// En yeni once; numara yeniden eskiye azalir
const AUDIT_LOGS: AuditLog[] = ENTRIES.map((entry, index) => ({
  id: ENTRIES.length - index,
  action: entry.action,
  entity_type: entry.entity[0],
  entity_id: entry.entity[1],
  ...ADMIN,
  before: entry.before,
  after: entry.after,
  created_at: entry.at,
}));

function matches(log: AuditLog, params: URLSearchParams): boolean {
  const type = params.get("entity_type");
  const id = params.get("entity_id");
  return (type === null || log.entity_type === type) && (id === null || log.entity_id === Number(id));
}

export const adminAuditLogHandlers = [
  http.get(apiUrl("/admin/audit-logs"), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? 1);
    const size = Number(params.get("page_size") ?? DEFAULT_PAGE_SIZE);
    const found = AUDIT_LOGS.filter((log) => matches(log, params));
    return HttpResponse.json({ items: found.slice((page - 1) * size, page * size), total: found.length, page });
  }),
];
