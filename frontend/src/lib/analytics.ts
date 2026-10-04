// Mudur "Genel bakis" ekraninin kurallari: bicimlendirme, degisim yonu, donem araligi ve grafik
// basliklari (docs/UI_GUIDE.md bolum 5.4). Backend sureleri dakika, oranlari yuzde (0-100) gonderir;
// veri yoksa null gelir ve ekranda tire (NO_DATA) gosterilir.
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type KpisRead = Schemas["KpisRead"];
export type TrendRead = Schemas["TrendRead"];
export type CategoriesRead = Schemas["CategoriesRead"];
export type SummaryPeriod = Schemas["SummaryPeriod"];
type Granularity = Schemas["Granularity"];

const NO_DATA = "–";
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PERCENT = 100;
const LOCALE = "tr-TR";
const TIME_ZONE = "Europe/Istanbul";

export const PERIODS: readonly { value: SummaryPeriod; label: string; days: number }[] = [
  { value: "7d", label: "Son 7 gün", days: 7 },
  { value: "30d", label: "Son 30 gün", days: 30 },
];

export function periodDays(period: SummaryPeriod): number {
  return PERIODS.find((item) => item.value === period)?.days ?? PERIODS[0]!.days;
}

export function formatCount(value: number | null): string {
  return value === null ? NO_DATA : String(Math.round(value));
}

export function formatPercent(value: number | null): string {
  return value === null ? NO_DATA : `%${Math.round(value)}`;
}

export function formatMinutes(value: number | null): string {
  if (value === null) {
    return NO_DATA;
  }
  const minutes = Math.round(value);
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} dk`;
  }
  if (minutes >= MINUTES_PER_DAY) {
    return `${Math.floor(minutes / MINUTES_PER_DAY)} gün`;
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`;
}

// Degisimin rengi yone degil iyi/kotu olmasina gore: acik bildirim artarsa kotu, SLA uyumu artarsa iyi.
// "none": ne iyi ne kotu sayilan sayilar (ornek: bugun acilan)
export type Better = "higher" | "lower" | "none";
export type DeltaTone = "good" | "bad" | "none";

export interface DeltaView {
  text: string;
  tone: DeltaTone;
}

export function deltaView(deltaPct: number | null, better: Better): DeltaView {
  if (deltaPct === null) {
    return { text: NO_DATA, tone: "none" };
  }
  const rounded = Math.round(deltaPct);
  if (rounded === 0) {
    return { text: "Değişmedi", tone: "none" };
  }
  const text = `${rounded > 0 ? "▲" : "▼"} %${Math.abs(rounded)}`;
  if (better === "none") {
    return { text, tone: "none" };
  }
  const improved = better === "higher" ? rounded > 0 : rounded < 0;
  return { text, tone: improved ? "good" : "bad" };
}

type KpiKey = Exclude<keyof KpisRead, "period">;

const KPI_CARDS: readonly { key: KpiKey; label: string; format: (value: number | null) => string; better: Better }[] = [
  { key: "open_cases", label: "Açık bildirim", format: formatCount, better: "lower" },
  { key: "sla_compliance_pct", label: "SLA uyumu", format: formatPercent, better: "higher" },
  { key: "avg_resolution_min", label: "Ortalama çözüm süresi", format: formatMinutes, better: "lower" },
  { key: "automation_pct", label: "Otomasyon oranı", format: formatPercent, better: "higher" },
  { key: "cases_today", label: "Bugün açılan", format: formatCount, better: "none" },
  { key: "human_review_pct", label: "Müdür incelemesi oranı", format: formatPercent, better: "lower" },
];

export interface KpiCardView {
  label: string;
  value: string;
  delta: DeltaView;
  // Onceki donemde veri yoksa karsilastirma yapilamaz
  hasPrevious: boolean;
}

export function kpiCards(kpis: KpisRead): KpiCardView[] {
  return KPI_CARDS.map((card) => {
    const kpi = kpis[card.key];
    return {
      label: card.label,
      value: card.format(kpi.value),
      delta: deltaView(kpi.delta_pct, card.better),
      hasPrevious: kpi.delta_pct !== null,
    };
  });
}

const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

// Bugun dahil son N gun, Europe/Istanbul takvimine gore (backend ortak filtresi: ?from=&to=)
export function periodRange(period: SummaryPeriod, now: Date = new Date()): { from: string; to: string } {
  const start = new Date(now.getTime() - (periodDays(period) - 1) * MS_PER_DAY);
  return { from: isoDate.format(start), to: isoDate.format(now) };
}

export function granularityFor(period: SummaryPeriod): Granularity {
  return period === "7d" ? "day" : "week";
}

type TrendPoint = TrendRead["points"][number];

export function trendHeadline(points: readonly TrendPoint[]): string {
  const opened = points.reduce((sum, point) => sum + point.opened, 0);
  const closed = points.reduce((sum, point) => sum + point.closed, 0);
  if (opened === 0 && closed === 0) {
    return "Bu dönemde bildirim yok";
  }
  return `${opened} bildirim açıldı, ${closed} bildirim kapandı`;
}

export function topCategoryHeadline(categories: CategoriesRead): string {
  const top = [...categories.items].sort((a, b) => b.count - a.count)[0];
  if (!top || categories.total === 0) {
    return "Kategori dağılımı";
  }
  return `En çok sorun: ${top.label} (%${Math.round((top.count / categories.total) * PERCENT)})`;
}

const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });

// Kova tarihi saatsiz gelir ("2026-10-05"); gun kaymasin diye UTC olarak okunur
export function bucketLabel(bucket: string, granularity: Granularity): string {
  const date = new Date(`${bucket}T00:00:00Z`);
  return granularity === "day" ? weekday.format(date) : dayMonth.format(date);
}

export function barPercent(value: number, max: number): number {
  return max > 0 ? Math.round((value / max) * PERCENT) : 0;
}
