// "Excel'e aktar" tablolari: her listenin sutunlari ekrandaki sozcuklerle; sayilar sayi olarak yazilir
// (Excel'de toplanip suzulebilsin). Kodlar ve numaralar okunur ada cevrilir (ekrandaki gibi).
import type { components } from "@/lib/api/types";

import { userAssignment } from "./admin";
import { AUTONOMY_LABELS, toPercent, type AgentPolicyRow } from "./adminAgentPolicies";
import { departmentLabel, type CaseType } from "./adminCaseTypes";
import type { Department } from "./adminDepartments";
import {
  filterLocations,
  isFiltered,
  KIND_LABELS,
  locationRows,
  locationTrail,
  type AdminLocation,
  type LocationFilters,
} from "./adminLocations";
import { formatDuration, type SlaRuleRow } from "./adminSlaRules";
import { actionLabel, auditChanges, recordName, type AuditLog, type NameLookup } from "./auditLogs";
import { CASE_STATUS_LABELS, caseSla, type CaseRead } from "./caseList";
import { formatDateTime } from "./dates";
import { CATEGORY_LABELS } from "./reports";
import { ROLE_LABELS } from "./shell";
import { PRIORITY_LABELS } from "./tasks";
import type { Sheet } from "./xlsx";

type UserRead = components["schemas"]["UserRead"];
type Named = readonly { id: number; name: string }[];

const NONE = "–";
const statusText = (active: boolean) => (active ? "Aktif" : "Pasif");
const yesNo = (value: boolean) => (value ? "Evet" : "Hayır");

export function usersSheet(users: readonly UserRead[], departments: Named): Sheet {
  return {
    name: "Kullanıcılar",
    columns: ["Ad soyad", "E-posta", "Rol", "Birim / tür", "Son giriş", "Durum"],
    rows: users.map((user) => [
      user.full_name,
      user.email,
      ROLE_LABELS[user.role],
      userAssignment(user, departments),
      user.last_login_at ? formatDateTime(user.last_login_at) : "Hiç giriş yapmadı",
      statusText(user.is_active),
    ]),
  };
}

// Kullanici listesi yuklenemediyse aktif kullanici sayisi bos kalir
export function departmentsSheet(departments: readonly Department[], counts: Map<number, number> | null): Sheet {
  return {
    name: "Birimler",
    columns: ["Birim", "Kod", "Aktif kullanıcı", "Durum"],
    rows: departments.map((department) => [
      department.name,
      department.code,
      counts ? (counts.get(department.id) ?? 0) : null,
      statusText(department.is_active),
    ]),
  };
}

// Aramasiz aktarimda agacin tamami (kapali dallar dahil) agac sirasiyla; aramada uyan konumlar
function exportedLocations(locations: readonly AdminLocation[], filters: LocationFilters): AdminLocation[] {
  if (isFiltered(filters)) {
    return filterLocations(locations, filters);
  }
  const everyBranch = new Set(locations.map((location) => location.id));
  return locationRows(locations, everyBranch).map((row) => row.location);
}

export function locationsSheet(locations: readonly AdminLocation[], filters: LocationFilters): Sheet {
  return {
    name: "Konumlar",
    columns: ["Konum", "Yeri", "Tür", "Kod", "Önem", "Durum"],
    rows: exportedLocations(locations, filters).map((location) => [
      location.name,
      locationTrail(location, locations) || NONE,
      KIND_LABELS[location.kind],
      location.code,
      location.importance_weight,
      statusText(location.is_active),
    ]),
  };
}

export function caseTypesSheet(caseTypes: readonly CaseType[], departments: Named | undefined): Sheet {
  return {
    name: "Bildirim Türleri",
    columns: ["Tür", "Kod", "Kategori", "Görevi alan birim", "Öncelik", "Güvenlikle ilgili", "Durum"],
    rows: caseTypes.map((caseType) => [
      caseType.name,
      caseType.code,
      CATEGORY_LABELS[caseType.category],
      departmentLabel(caseType.default_department_id, departments),
      PRIORITY_LABELS[caseType.base_priority],
      yesNo(caseType.is_safety_related),
      statusText(caseType.is_active),
    ]),
  };
}

export function slaRulesSheet(rows: readonly SlaRuleRow[]): Sheet {
  return {
    name: "Süre Hedefleri",
    columns: ["Tür", "Kod", "Öncelik", "Kabul hedefi", "Çözüm hedefi", "Uyarı eşiği (%)", "Durum"],
    rows: rows.map(({ rule, typeName, typeCode }) => [
      typeName,
      typeCode ?? NONE,
      PRIORITY_LABELS[rule.priority],
      formatDuration(rule.response_minutes),
      formatDuration(rule.resolution_minutes),
      rule.warning_threshold_pct,
      statusText(rule.is_active),
    ]),
  };
}

export function agentPoliciesSheet(rows: readonly AgentPolicyRow[]): Sheet {
  return {
    name: "Yapay Zekâ Politikaları",
    columns: ["Tür", "Kod", "Karar yetkisi", "Güven eşiği (%)"],
    rows: rows.map(({ name, code, policy }) => [
      name,
      code ?? NONE,
      AUTONOMY_LABELS[policy.autonomy_level],
      toPercent(policy.min_confidence_auto),
    ]),
  };
}

// Degisiklikler tek hucrede "Alan: once -> sonra; ..." (yeni kayitta yalniz yeni deger)
function changesText(log: AuditLog, lookup: NameLookup): string {
  return auditChanges(log, lookup)
    .map((change) => `${change.label}: ${change.before === null ? change.after : `${change.before} → ${change.after}`}`)
    .join("; ");
}

export function auditLogsSheet(logs: readonly AuditLog[], lookup: NameLookup): Sheet {
  return {
    name: "İşlem Kayıtları",
    columns: ["Zaman", "Kim", "İşlem", "Kayıt", "Değişiklik"],
    rows: logs.map((log) => [
      formatDateTime(log.created_at),
      log.actor_name,
      actionLabel(log),
      recordName(log, lookup),
      changesText(log, lookup),
    ]),
  };
}

// Kalan sure aktarim anina gore yazilir (ekrandaki rozetle ayni metin)
export function casesSheet(cases: readonly CaseRead[], title: string, now: Date = new Date()): Sheet {
  return {
    name: title,
    columns: ["Bildirim no", "Başlık", "Tür", "Konum", "Birim", "Durum", "Öncelik", "Kalan süre", "Açılış"],
    rows: cases.map((item) => [
      item.case_number,
      item.title,
      item.case_type?.name ?? "Tür belirlenmedi",
      item.location.name,
      item.department?.name ?? NONE,
      CASE_STATUS_LABELS[item.status],
      item.priority ? PRIORITY_LABELS[item.priority] : NONE,
      caseSla(item, now)?.label ?? NONE,
      formatDateTime(item.created_at),
    ]),
  };
}
