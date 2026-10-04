// Mudurun "Tum Bildirimler" listesinin kurallari (/manager/cases; docs/UI_GUIDE.md bolum 5.4):
// durum adlari, suzgec gruplari, istek sorgusu ve satir metinleri.
import type { components } from "@/lib/api/types";
import { duration, type Priority, type SlaView } from "@/lib/tasks";

type Schemas = components["schemas"];
export type CaseRead = Schemas["CaseRead"];
export type CaseStatus = Schemas["CaseStatus"];

// Backend varsayilani ile ayni (backend/app/core/constants.py PAGE_SIZE_DEFAULT)
export const CASE_LIST_PAGE_SIZE = 20;
const MS_PER_MINUTE = 60_000;

// Mudurun gordugu durum adlari (bildirim yapan 4 adimli sade gorunumu gorur: lib/status.ts)
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  NEW: "Yeni",
  ANALYZING: "İnceleniyor",
  NEEDS_INFO: "Bilgi bekleniyor",
  CLASSIFIED: "Sınıflandırıldı",
  ASSIGNED: "Atandı",
  ACCEPTED: "Kabul edildi",
  IN_PROGRESS: "Çalışılıyor",
  RESOLVED: "Çözüldü",
  VERIFICATION: "Doğrulanıyor",
  CLOSED: "Kapandı",
  REOPENED: "Yeniden açıldı",
  ESCALATED: "Müdüre yükseltildi",
  REJECTED: "Reddedildi",
  MERGED: "Birleştirildi",
};

// Kapanana kadar gecen butun durumlar; kalan sure rozeti yalniz bunlarda gosterilir
const OPEN_STATUSES: readonly CaseStatus[] = [
  "NEW",
  "ANALYZING",
  "NEEDS_INFO",
  "CLASSIFIED",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "RESOLVED",
  "VERIFICATION",
  "REOPENED",
  "ESCALATED",
];

export type StatusGroup = "all" | "open" | "closed" | "dismissed" | "late";

interface StatusGroupOption {
  value: StatusGroup;
  label: string;
  statuses: readonly CaseStatus[];
  // Yalniz hedef suresi asilanlar
  lateOnly?: boolean;
}

// 14 durum yerine 5 secenek: mudur tek tek durum secmek zorunda kalmaz
export const STATUS_GROUPS: readonly StatusGroupOption[] = [
  { value: "all", label: "Tümü", statuses: [] },
  { value: "open", label: "Açık", statuses: OPEN_STATUSES },
  { value: "closed", label: "Kapanan", statuses: ["CLOSED"] },
  { value: "dismissed", label: "Reddedilen ve birleştirilen", statuses: ["REJECTED", "MERGED"] },
  { value: "late", label: "Geciken", statuses: OPEN_STATUSES, lateOnly: true },
];

export interface CaseFilters {
  group: StatusGroup;
  priority: Priority | null;
  search: string;
}

export const DEFAULT_FILTERS: CaseFilters = { group: "all", priority: null, search: "" };

export function isFiltered(filters: CaseFilters): boolean {
  return filters.group !== "all" || filters.priority !== null || filters.search.trim() !== "";
}

// Ortak filtreler (docs/API.md "Cases"): status (tekrarlanir), priority, sla_status, q
export function caseListQuery(filters: CaseFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page), page_size: String(CASE_LIST_PAGE_SIZE) });
  const group = STATUS_GROUPS.find((item) => item.value === filters.group);
  group?.statuses.forEach((status) => params.append("status", status));
  if (group?.lateOnly) {
    params.set("sla_status", "BREACHED");
  }
  if (filters.priority) {
    params.set("priority", filters.priority);
  }
  const search = filters.search.trim();
  if (search) {
    params.set("q", search);
  }
  return params.toString();
}

// Konum okunur adiyla yazilir; path kod yoludur ("KMP/B/B-Z/B-Z-WC")
export function caseSubtitle(item: CaseRead): string {
  return `${item.case_type?.name ?? "Tür belirlenmedi"} · ${item.location.name}`;
}

// Kalan sure rozeti: renk backend'in sla_status degerinden, metin bitis zamanina kalan sureden gelir.
// Bitmis (kapanan, reddedilen, birlestirilen) ya da hedef suresi olmayan bildirimde gosterilmez.
export function caseSla(item: CaseRead, now: Date = new Date()): SlaView | null {
  if (!item.due_at || !item.sla_status || !OPEN_STATUSES.includes(item.status)) {
    return null;
  }
  const minutes = Math.floor((new Date(item.due_at).getTime() - now.getTime()) / MS_PER_MINUTE);
  const label = minutes >= 0 ? `${duration(minutes)} kaldı` : `${duration(-minutes)} gecikti`;
  return { status: item.sla_status, label };
}

export function shownSummary(loaded: number, total: number): string {
  return loaded < total ? `${total} bildirimin ilk ${loaded} tanesi gösteriliyor` : `${total} bildirim`;
}
