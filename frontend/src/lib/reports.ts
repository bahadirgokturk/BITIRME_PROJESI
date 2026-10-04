// Mudur "Raporlar" ekraninin kurallari: kart basliklari, siralama ve satir metinleri
// (docs/UI_GUIDE.md bolum 5.4). Her baslik sorunun cevabini soyler; veri yoksa duz bir ad gosterilir.
import type { components } from "@/lib/api/types";
import { barPercent, formatMinutes, formatPercent, type DeltaTone } from "@/lib/analytics";
import { PRIORITY_LABELS } from "@/lib/tasks";

type Schemas = components["schemas"];
export type LocationsRead = Schemas["LocationsRead"];
export type ResolutionTimesRead = Schemas["ResolutionTimesRead"];
export type ResolutionTimeRow = Schemas["ResolutionTimeRow"];
export type SlaRead = Schemas["SlaRead"];
export type AgingRead = Schemas["AgingRead"];
export type DepartmentsRead = Schemas["DepartmentsRead"];
export type DepartmentPerformance = Schemas["DepartmentPerformance"];
export type RecurringRead = Schemas["RecurringRead"];
export type RecurringProblem = RecurringRead["items"][number];
export type ProcessRead = Schemas["ProcessRead"];
export type ProcessStep = Schemas["ProcessStep"];
type CaseCategory = Schemas["CaseCategory"];
type Priority = Schemas["Priority"];
type TrendDirection = Schemas["TrendDirection"];

const NO_DATA = "–";
const LOCALE = "tr-TR";

// Backend ile ayni adlar (backend/app/agents/analytics_summary.py CATEGORY_LABELS); lokasyon
// cevabinda kategori yalniz kod olarak gelir
const CATEGORY_LABELS: Record<CaseCategory, string> = {
  CLEANING: "Temizlik",
  CONSUMABLE: "Sarf malzemesi",
  TECHNICAL: "Teknik",
  IT: "Bilgi teknolojileri",
  INFRASTRUCTURE: "Altyapı",
  SECURITY: "Güvenlik",
  FOOD_SERVICE: "Yemekhane",
  OTHER: "Diğer",
};

// En acil is en ustte
const PRIORITY_ORDER: readonly Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const decimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

export function formatDecimal(value: number | null): string {
  return value === null ? NO_DATA : decimal.format(value);
}

function largest<T>(items: readonly T[], measure: (item: T) => number | null): T | undefined {
  return items
    .filter((item) => measure(item) !== null)
    .sort((a, b) => (measure(b) ?? 0) - (measure(a) ?? 0))[0];
}

export function busiestLocationHeadline(locations: LocationsRead): string {
  const top = largest(locations.items, (item) => item.count);
  return top && top.count > 0 ? `En yoğun bina: ${top.location.name} (${top.count} bildirim)` : "Bina yoğunluğu";
}

export interface BarRowView {
  label: string;
  value: string;
  percent: number;
  hint?: string;
}

export interface LocationRowView {
  id: number;
  name: string;
  count: number;
  percent: number;
  hint: string | null;
}

function topCategoryHint(byCategory: Record<string, number>): string | null {
  const top = largest(Object.entries(byCategory), ([, count]) => count);
  return top ? `En çok: ${CATEGORY_LABELS[top[0] as CaseCategory] ?? top[0]}` : null;
}

export function locationRows(locations: LocationsRead): LocationRowView[] {
  const items = [...locations.items].sort((a, b) => b.count - a.count);
  const max = items[0]?.count ?? 0;
  return items.map((item) => ({
    id: item.location.id,
    name: item.location.name,
    count: item.count,
    percent: barPercent(item.count, max),
    hint: topCategoryHint(item.by_category),
  }));
}

export function slaHeadline(sla: SlaRead): string {
  return sla.compliance_pct === null ? "Zamanında çözülen" : `Zamanında çözülen: ${formatPercent(sla.compliance_pct)}`;
}

export function slaSummary(sla: SlaRead): string {
  return `${sla.with_sla} bildirimden ${sla.met} tanesi zamanında çözüldü, ${sla.breached} tanesi gecikti.`;
}

export interface SlaRowView extends BarRowView {
  priority: Priority;
}

export function slaRows(sla: SlaRead): SlaRowView[] {
  return PRIORITY_ORDER.flatMap((priority) => {
    const row = sla.by_priority.find((item) => item.priority === priority);
    if (!row || row.compliance_pct === null) {
      return [];
    }
    return [
      {
        priority,
        label: PRIORITY_LABELS[priority],
        value: formatPercent(row.compliance_pct),
        percent: Math.round(row.compliance_pct),
        hint: `${row.with_sla} işten ${row.met} tanesi zamanında`,
      },
    ];
  });
}

export function slowestCategoryHeadline(rows: readonly ResolutionTimeRow[]): string {
  const slowest = largest(rows, (row) => row.median_min);
  return slowest ? `En uzun süren: ${slowest.label} (tipik ${formatMinutes(slowest.median_min)})` : "Çözüm süreleri";
}

export function agingHeadline(aging: AgingRead): string {
  return aging.total_open > 0 ? `${aging.total_open} bildirim bekliyor` : "Bekleyen bildirim yok";
}

// Ust siniri olmayan son kova (ornek: 24+ saat) doluysa ayrica soylenir
export function agingNote(aging: AgingRead): string | null {
  const oldest = aging.buckets.find((bucket) => bucket.max_hours === null);
  if (!oldest || oldest.count === 0) {
    return null;
  }
  return `${oldest.count} bildirim ${oldest.min_hours} saatten uzun süredir açık.`;
}

export function busiestDepartmentHeadline(items: readonly DepartmentPerformance[]): string {
  const busiest = largest(items, (item) => item.open_tasks_per_staff);
  if (!busiest) {
    return "Birim performansı";
  }
  const perStaff = formatDecimal(busiest.open_tasks_per_staff);
  return `En yoğun birim: ${busiest.department.name} (kişi başı ${perStaff} açık görev)`;
}

export function recurringHeadline(count: number): string {
  return count > 0 ? `${count} sorun tekrar ediyor` : "Tekrar eden sorun yok";
}

export function recurringSubtitle(rule: Pick<RecurringRead, "threshold" | "window_days">): string {
  return `Son ${rule.window_days} günde aynı yerde ${rule.threshold} ve daha fazla kez bildirilenler`;
}

// Tekrarlayan sorun artiyorsa kotu, azaliyorsa iyi
const TREND_VIEW: Record<TrendDirection, { text: string; tone: DeltaTone }> = {
  up: { text: "▲ Artıyor", tone: "bad" },
  down: { text: "▼ Azalıyor", tone: "good" },
  flat: { text: "Değişmedi", tone: "none" },
};

export function recurringTrend(direction: TrendDirection): { text: string; tone: DeltaTone } {
  return TREND_VIEW[direction];
}

export function bottleneckHeadline(process: ProcessRead): string {
  return process.bottleneck ? `En yavaş adım: ${process.bottleneck.label}` : "Süreç adımları";
}

export function isBottleneck(step: ProcessStep, process: ProcessRead): boolean {
  const slowest = process.bottleneck;
  return slowest !== null && slowest.from_event === step.from_event && slowest.to_event === step.to_event;
}
