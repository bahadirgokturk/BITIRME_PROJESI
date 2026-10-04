// Sahte rapor verisi: /manager/analytics ve /manager/agents ekranlari icin. Sekiller backend
// sozlesmesiyle ayni (backend/app/schemas/analytics.py); sureler dakika, oranlar yuzde, veri yoksa null.
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type CaseCategory = Schemas["CaseCategory"];

const building = (id: number, name: string): Schemas["LocationSummary"] => ({ id, kind: "BUILDING", name, path: `KMP/${id}` });
const load = (id: number, name: string, by_category: Partial<Record<CaseCategory, number>>): Schemas["LocationLoad"] => ({
  location: building(id, name),
  count: Object.values(by_category).reduce((sum, count) => sum + count, 0),
  by_category,
});

export const LOCATIONS_WEEK: Schemas["LocationsRead"] = {
  level: "building",
  items: [
    load(1, "B Blok", { CLEANING: 12, CONSUMABLE: 6, TECHNICAL: 3 }),
    load(2, "A Blok", { TECHNICAL: 8, CLEANING: 4, SECURITY: 2 }),
    load(3, "Kütüphane", { IT: 7, CLEANING: 4 }),
    load(4, "Yemekhane", { CLEANING: 5, FOOD_SERVICE: 4 }),
    load(5, "Spor Salonu", { TECHNICAL: 3, CLEANING: 2 }),
    load(6, "Bahçe", { CLEANING: 3, OTHER: 1 }),
  ],
};

export const LOCATIONS_MONTH: Schemas["LocationsRead"] = {
  level: "building",
  items: [
    load(1, "B Blok", { CLEANING: 44, CONSUMABLE: 25, TECHNICAL: 13 }),
    load(2, "A Blok", { TECHNICAL: 33, CLEANING: 16, SECURITY: 7 }),
    load(3, "Kütüphane", { IT: 28, CLEANING: 15 }),
    load(4, "Yemekhane", { CLEANING: 19, FOOD_SERVICE: 16 }),
    load(5, "Spor Salonu", { TECHNICAL: 12, CLEANING: 7 }),
    load(6, "Bahçe", { CLEANING: 12, OTHER: 4 }),
  ],
};

export const SLA_WEEK: Schemas["SlaRead"] = {
  with_sla: 58,
  met: 53,
  breached: 5,
  compliance_pct: 91.4,
  by_priority: [
    { priority: "LOW", with_sla: 12, met: 12, breached: 0, compliance_pct: 100 },
    { priority: "MEDIUM", with_sla: 26, met: 24, breached: 2, compliance_pct: 92.3 },
    { priority: "HIGH", with_sla: 15, met: 13, breached: 2, compliance_pct: 86.7 },
    { priority: "CRITICAL", with_sla: 5, met: 4, breached: 1, compliance_pct: 80 },
  ],
};

export const SLA_MONTH: Schemas["SlaRead"] = {
  with_sla: 236,
  met: 210,
  breached: 26,
  compliance_pct: 89,
  by_priority: [
    { priority: "LOW", with_sla: 52, met: 51, breached: 1, compliance_pct: 98.1 },
    { priority: "MEDIUM", with_sla: 104, met: 95, breached: 9, compliance_pct: 91.3 },
    { priority: "HIGH", with_sla: 61, met: 50, breached: 11, compliance_pct: 82 },
    { priority: "CRITICAL", with_sla: 19, met: 14, breached: 5, compliance_pct: 73.7 },
  ],
};

export const RESOLUTION_TIMES: Schemas["ResolutionTimesRead"] = {
  items: [
    { category: "CLEANING", label: "Temizlik", count: 24, avg_min: 160, median_min: 110, p90_min: 360 },
    { category: "TECHNICAL", label: "Teknik", count: 13, avg_min: 560, median_min: 420, p90_min: 1440 },
    { category: "IT", label: "Bilgi teknolojileri", count: 10, avg_min: 310, median_min: 240, p90_min: 660 },
    { category: "SECURITY", label: "Güvenlik", count: 7, avg_min: 75, median_min: 50, p90_min: 180 },
    { category: "OTHER", label: "Diğer", count: 4, avg_min: 360, median_min: 330, p90_min: null },
  ],
};

export const AGING: Schemas["AgingRead"] = {
  total_open: 42,
  buckets: [
    { label: "0–2 sa", min_hours: 0, max_hours: 2, count: 14 },
    { label: "2–6 sa", min_hours: 2, max_hours: 6, count: 11 },
    { label: "6–12 sa", min_hours: 6, max_hours: 12, count: 8 },
    { label: "12–24 sa", min_hours: 12, max_hours: 24, count: 5 },
    { label: "24+ sa", min_hours: 24, max_hours: null, count: 4 },
  ],
};

const department = (
  id: number,
  code: string,
  name: string,
  numbers: Omit<Schemas["DepartmentPerformance"], "department">,
): Schemas["DepartmentPerformance"] => ({ department: { id, code, name }, ...numbers });

export const DEPARTMENTS_REPORT: Schemas["DepartmentsRead"] = {
  items: [
    department(1, "SUPPORT_SERVICES", "Destek Hizmetleri", {
      cases: 33,
      avg_resolution_min: 140,
      median_resolution_min: 100,
      sla_compliance_pct: 95,
      open_tasks: 12,
      active_staff: 8,
      open_tasks_per_staff: 1.5,
    }),
    department(2, "MAINTENANCE", "Bakım Onarım", {
      cases: 15,
      avg_resolution_min: 560,
      median_resolution_min: 420,
      sla_compliance_pct: 78,
      open_tasks: 18,
      active_staff: 4,
      open_tasks_per_staff: 4.5,
    }),
    department(3, "IT_SUPPORT", "Bilgi İşlem Teknik Destek", {
      cases: 11,
      avg_resolution_min: 310,
      median_resolution_min: 240,
      sla_compliance_pct: 90,
      open_tasks: 9,
      active_staff: 3,
      open_tasks_per_staff: 3,
    }),
    department(4, "NUTRITION", "Beslenme Hizmetleri", {
      cases: 5,
      avg_resolution_min: 180,
      median_resolution_min: 150,
      sla_compliance_pct: 100,
      open_tasks: 3,
      active_staff: 2,
      open_tasks_per_staff: 1.5,
    }),
  ],
};

// Gercek backend'de path kod yoludur ("KMP/B/B-2/B-2-WC"); ekranda okunur ad (name) gosterilir
const SUGGESTION = "Kalıcı çözüm (dispenser kapasitesi / periyodik kontrol) değerlendirilebilir.";

export const RECURRING: Schemas["RecurringRead"] = {
  threshold: 5,
  window_days: 30,
  items: [
    {
      location: { id: 21, kind: "WC", name: "B Blok 2. Kat Erkek WC", path: "KMP/B/B-2/B-2-WC" },
      case_type: { id: 1, code: "SOAP_EMPTY", name: "Sabun bitti" },
      count: 17,
      last_reported_at: "2026-10-07T06:40:00Z",
      avg_resolution_min: 95,
      trend: "up",
      suggestion: SUGGESTION,
    },
    {
      location: { id: 34, kind: "ROOM", name: "Kütüphane 1. Kat Çalışma Salonu", path: "KMP/KTP/KTP-1/KTP-1-SAL" },
      case_type: { id: 9, code: "INTERNET_DOWN", name: "İnternet yok" },
      count: 9,
      last_reported_at: "2026-10-06T11:15:00Z",
      avg_resolution_min: 240,
      trend: "flat",
      suggestion: "Kalıcı çözüm (erişim noktası kontrolü) değerlendirilebilir.",
    },
    {
      location: { id: 11, kind: "CORRIDOR", name: "A Blok Zemin Kat Giriş", path: "KMP/A/A-Z/A-Z-GRS" },
      case_type: { id: 3, code: "TRASH_FULL", name: "Çöp dolu" },
      count: 6,
      last_reported_at: "2026-10-05T14:05:00Z",
      avg_resolution_min: 70,
      trend: "down",
      suggestion: "Kalıcı çözüm (toplama sıklığı) değerlendirilebilir.",
    },
  ],
};

const step = (from_event: string, to_event: string, label: string, median_min: number): Schemas["ProcessStep"] => ({
  from_event,
  to_event,
  label,
  count: 58,
  avg_min: median_min + 3,
  median_min,
});

const BOTTLENECK = step("TASK_CREATED", "TASK_ACCEPTED", "Atamadan kabule", 42);

export const PROCESS: Schemas["ProcessRead"] = {
  steps: [
    step("CASE_CREATED", "TASK_CREATED", "Bildirimden atamaya", 4),
    BOTTLENECK,
    step("TASK_ACCEPTED", "TASK_STARTED", "Kabulden başlamaya", 18),
    step("TASK_STARTED", "TASK_COMPLETED", "Başlamadan tamamlamaya", 35),
    step("TASK_COMPLETED", "CASE_CLOSED", "Tamamlamadan kapanışa", 6),
  ],
  bottleneck: BOTTLENECK,
};

type AgentRow = [code: string, label: string, decisions: number, confidence: number, overrideRate: number];

const agents = (rows: AgentRow[]): Schemas["AgentMetric"][] =>
  rows.map(([agent, label, decisions, avg_confidence, override_rate_pct]) => ({
    agent,
    label,
    decisions,
    avg_confidence,
    override_rate_pct,
  }));

export const AGENT_METRICS_WEEK: Schemas["AgentMetricsRead"] = {
  period: { from: "2026-10-01", to: "2026-10-07" },
  automation_pct: 78,
  human_review_pct: 14,
  classification_accuracy_pct: 92,
  duplicate_precision_pct: 88,
  agents: agents([
    ["classification", "Tür belirleme", 64, 0.89, 6],
    ["duplicate", "Tekrar tespiti", 64, 0.84, 3],
    ["priority", "Öncelik belirleme", 58, 0.91, 4],
    ["routing", "Birime yönlendirme", 58, 0.86, 9],
    ["assignment", "Personel atama", 52, 0.93, 2],
    ["resolution", "Kanıt kontrolü", 47, 0.81, 5],
  ]),
};

export const AGENT_METRICS_MONTH: Schemas["AgentMetricsRead"] = {
  period: { from: "2026-09-08", to: "2026-10-07" },
  automation_pct: 76,
  human_review_pct: 16,
  classification_accuracy_pct: 90,
  duplicate_precision_pct: 85,
  agents: agents([
    ["classification", "Tür belirleme", 251, 0.88, 7],
    ["duplicate", "Tekrar tespiti", 251, 0.83, 4],
    ["priority", "Öncelik belirleme", 236, 0.9, 5],
    ["routing", "Birime yönlendirme", 236, 0.85, 11],
    ["assignment", "Personel atama", 214, 0.92, 3],
    ["resolution", "Kanıt kontrolü", 198, 0.8, 6],
  ]),
};

// Secilen donemde hic karar yok (bos durum)
export const AGENT_METRICS_EMPTY: Schemas["AgentMetricsRead"] = {
  period: AGENT_METRICS_WEEK.period,
  automation_pct: null,
  human_review_pct: null,
  classification_accuracy_pct: null,
  duplicate_precision_pct: null,
  agents: [],
};
