// Yonetim > Islem Kayitlari kurallari (docs/UI_GUIDE.md bolum 5.5, docs/API.md "GET /admin/audit-logs").
// Kayit ham alan adlari ve kodlarla gelir (before/after); burada ekranlarin kullandigi sozcuklere cevrilir.
import { AUTONOMY_LABELS, agentPolicyRows, formatConfidence, type AgentPolicy } from "@/lib/adminAgentPolicies";
import { KIND_LABELS } from "@/lib/adminLocations";
import { formatDuration, slaRuleRows, type SlaRule } from "@/lib/adminSlaRules";
import type { components } from "@/lib/api/types";
import { CATEGORY_LABELS } from "@/lib/reports";
import { REPORTER_KIND_LABELS, ROLE_LABELS } from "@/lib/shell";
import { PRIORITY_LABELS } from "@/lib/tasks";

type Schemas = components["schemas"];
export type AuditLog = Schemas["AuditLogRead"];
export type AuditEntity = Schemas["AuditEntity"];

export const ENTITY_LABELS: Record<AuditEntity, string> = {
  USER: "Kullanıcı",
  DEPARTMENT: "Birim",
  LOCATION: "Konum",
  CASE_TYPE: "Bildirim türü",
  SLA_RULE: "Süre hedefi",
  AGENT_POLICY: "Yapay zekâ politikası",
};

const NO_VALUE = "–";
const PRIORITY_SEPARATOR = " · ";
// backend/app/services/audit.py: eylem adi <ENTITY>_CREATED ya da <ENTITY>_UPDATED
const VERBS: [suffix: string, text: string][] = [
  ["_CREATED", "eklendi"],
  ["_UPDATED", "güncellendi"],
];

// "Birim guncellendi"; taninmayan eylem oldugu gibi gosterilir (yeni bir eylem eklenirse kayit gizlenmesin)
export function actionLabel(log: AuditLog): string {
  const verb = VERBS.find(([suffix]) => log.action.endsWith(suffix));
  return verb ? `${ENTITY_LABELS[log.entity_type]} ${verb[1]}` : log.action;
}

export type NameLookup = (entity: AuditEntity, id: number) => string | undefined;

interface Named {
  id: number;
  name: string;
}

interface NameSources {
  users?: readonly { id: number; full_name: string }[];
  departments?: readonly Named[];
  locations?: readonly Named[];
  caseTypes?: readonly (Named & { code: string })[];
  slaRules?: readonly SlaRule[];
  agentPolicies?: readonly AgentPolicy[];
}

const toEntries = (items: readonly Named[] | undefined): [number, string][] =>
  (items ?? []).map((item) => [item.id, item.name]);

// Kayitta yalniz numara vardir (entity_id); adlar yonetim listelerinden bulunur. Liste henuz gelmediyse ad yoktur.
export function buildNameLookup(sources: NameSources): NameLookup {
  const sla = slaRuleRows(sources.slaRules ?? [], sources.caseTypes);
  const policies = agentPolicyRows(sources.agentPolicies ?? [], sources.caseTypes);
  const names: Record<AuditEntity, Map<number, string>> = {
    USER: new Map((sources.users ?? []).map((user) => [user.id, user.full_name])),
    DEPARTMENT: new Map(toEntries(sources.departments)),
    LOCATION: new Map(toEntries(sources.locations)),
    CASE_TYPE: new Map(toEntries(sources.caseTypes)),
    SLA_RULE: new Map(
      sla.map((row) => [row.rule.id, `${row.typeName}${PRIORITY_SEPARATOR}${PRIORITY_LABELS[row.rule.priority]}`]),
    ),
    AGENT_POLICY: new Map(policies.map((row) => [row.policy.id, row.name])),
  };
  return (entity, id) => names[entity].get(id);
}

type Values = Record<string, unknown>;

const NAME_KEYS = ["name", "full_name"];

function writtenName(values: Values | null | undefined): string | undefined {
  const key = NAME_KEYS.find((candidate) => typeof values?.[candidate] === "string");
  return key ? (values?.[key] as string) : undefined;
}

// Once guncel listedeki ad, sonra kaydin icinde yazan ad, hicbiri yoksa kayit numarasi
export function recordName(log: AuditLog, lookup: NameLookup): string {
  return lookup(log.entity_type, log.entity_id) ?? writtenName(log.after) ?? writtenName(log.before) ?? `#${log.entity_id}`;
}

export function isCreation(log: AuditLog): boolean {
  return log.before === null || log.before === undefined;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Ad",
  full_name: "Ad soyad",
  code: "Kod",
  email: "E-posta",
  role: "Rol",
  reporter_kind: "Kullanıcı türü",
  department_id: "Birim",
  is_active: "Durum",
  parent_id: "Üst konum",
  kind: "Konum türü",
  path: "Yol",
  importance_weight: "Önem",
  aliases: "Diğer adlar",
  category: "Kategori",
  default_department_id: "Görevi alan birim",
  secondary_department_id: "Bilgilendirilen birim",
  base_priority: "Başlangıç önceliği",
  base_severity: "Ciddiyet",
  is_safety_related: "Güvenlikle ilgili",
  keywords: "Anahtar kelimeler",
  case_type_id: "Tür",
  priority: "Öncelik",
  response_minutes: "Kabul hedefi",
  resolution_minutes: "Çözüm hedefi",
  warning_threshold_pct: "Uyarı eşiği",
  autonomy_level: "Karar yetkisi",
  min_confidence_auto: "Güven eşiği",
  notify_manager: "Müdüre haber",
  scope: "Kapsam",
};

type Formatter = (value: unknown, lookup: NameLookup) => string;

const fromLabels =
  (labels: Record<string, string>): Formatter =>
  (value) =>
    labels[String(value)] ?? String(value);

const fromLookup =
  (entity: AuditEntity): Formatter =>
  (value, lookup) =>
    lookup(entity, Number(value)) ?? `#${String(value)}`;

// Alana ozel yazim; burada olmayan alan genel kurallarla yazilir (formatValue)
const FORMATTERS: Record<string, Formatter> = {
  is_active: (value) => (value ? "Aktif" : "Pasif"),
  role: fromLabels(ROLE_LABELS),
  reporter_kind: fromLabels(REPORTER_KIND_LABELS),
  kind: fromLabels(KIND_LABELS),
  category: fromLabels(CATEGORY_LABELS),
  base_priority: fromLabels(PRIORITY_LABELS),
  priority: fromLabels(PRIORITY_LABELS),
  autonomy_level: fromLabels(AUTONOMY_LABELS),
  scope: fromLabels({ CASE_TYPE: "Bildirim türü", CATEGORY: "Kategori" }),
  department_id: fromLookup("DEPARTMENT"),
  default_department_id: fromLookup("DEPARTMENT"),
  secondary_department_id: fromLookup("DEPARTMENT"),
  parent_id: fromLookup("LOCATION"),
  case_type_id: fromLookup("CASE_TYPE"),
  response_minutes: (value) => formatDuration(Number(value)),
  resolution_minutes: (value) => formatDuration(Number(value)),
  warning_threshold_pct: (value) => `%${String(value)}`,
  min_confidence_auto: (value) => formatConfidence(Number(value)),
};

function plainValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Evet" : "Hayır";
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

function formatValue(key: string, value: unknown, lookup: NameLookup): string {
  if (isEmpty(value)) {
    return NO_VALUE;
  }
  const formatter = FORMATTERS[key];
  return formatter ? formatter(value, lookup) : plainValue(value);
}

export interface AuditChange {
  label: string;
  // Yeni kayitta onceki deger yoktur
  before: string | null;
  after: string;
}

// Kayit numarasi kullaniciya bir sey anlatmaz; ad zaten ayri gosterilir
const HIDDEN_KEYS = new Set(["id"]);

// Guncellemede yalniz degisen alanlar gelir; eklemede after tam kayittir (before bos)
export function auditChanges(log: AuditLog, lookup: NameLookup): AuditChange[] {
  const created = isCreation(log);
  return Object.entries(log.after ?? {})
    .filter(([key]) => !HIDDEN_KEYS.has(key))
    .map(([key, value]) => ({
      label: FIELD_LABELS[key] ?? key,
      before: created ? null : formatValue(key, log.before?.[key], lookup),
      after: formatValue(key, value, lookup),
    }));
}

const AUDIT_PATH = "/admin/audit-logs";

// Diger sekmelerdeki "Gecmisi gor" baglantisi: tek kaydin gecmisi
export function historyHref(entity: AuditEntity, id: number): string {
  return `${AUDIT_PATH}?entity_type=${entity}&entity_id=${id}`;
}

export interface AuditTarget {
  entityType: AuditEntity;
  entityId: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

const WHOLE_NUMBER = /^\d+$/;

// Adresteki suzgec elle de yazilabilir; eksik ya da taninmayan deger yok sayilir (butun kayitlar gosterilir)
export function parseAuditTarget(params: SearchParams): AuditTarget | null {
  const { entity_type: type, entity_id: id } = params;
  if (typeof type !== "string" || typeof id !== "string" || !(type in ENTITY_LABELS) || !WHOLE_NUMBER.test(id)) {
    return null;
  }
  return { entityType: type as AuditEntity, entityId: Number(id) };
}

interface PageInfo {
  page: number;
  pageSize: number;
  total: number;
}

// "1-50 / 312 kayit"; tek sayfaya sigiyorsa yalniz sayi
export function pageSummary({ page, pageSize, total }: PageInfo): string {
  if (total <= pageSize) {
    return `${total} kayıt`;
  }
  const first = (page - 1) * pageSize + 1;
  return `${first}–${Math.min(page * pageSize, total)} / ${total} kayıt`;
}
