// Birim Performansi ekranlarinin kurallari (docs/UI_GUIDE.md bolum 5.4): kart metinleri, birim filtresi,
// detay adresi. Sayilar backend'in /analytics/departments cevabindan gelir.
import { formatMinutes, formatPercent, type SummaryPeriod } from "@/lib/analytics";
import type { FilterOption } from "@/lib/filters";
import { formatDecimal, type DepartmentPerformance } from "@/lib/reports";

const LOCALE = "tr-TR";

export interface DepartmentStat {
  label: string;
  value: string;
}

export interface DepartmentCardView {
  id: number;
  name: string;
  stats: DepartmentStat[];
  staff: string;
}

export function departmentStats(item: DepartmentPerformance): DepartmentStat[] {
  return [
    { label: "Bildirim", value: String(item.cases) },
    { label: "Zamanında", value: formatPercent(item.sla_compliance_pct) },
    { label: "Tipik çözüm", value: formatMinutes(item.median_resolution_min) },
    { label: "Açık görev", value: String(item.open_tasks) },
  ];
}

export function departmentStaff(item: DepartmentPerformance): string {
  if (item.active_staff === 0) {
    return "Personel yok";
  }
  const perStaff = item.open_tasks_per_staff === null ? "" : ` · kişi başı ${formatDecimal(item.open_tasks_per_staff)} açık görev`;
  return `${item.active_staff} personel${perStaff}`;
}

// En cok bildirim alan birim once; esitse ada gore. Secim bossa butun birimler.
export function departmentCards(items: readonly DepartmentPerformance[], selected: readonly number[]): DepartmentCardView[] {
  return items
    .filter((item) => selected.length === 0 || selected.includes(item.department.id))
    .sort((a, b) => b.cases - a.cases || a.department.name.localeCompare(b.department.name, LOCALE))
    .map((item) => ({
      id: item.department.id,
      name: item.department.name,
      stats: departmentStats(item),
      staff: departmentStaff(item),
    }));
}

export function departmentOptions(items: readonly DepartmentPerformance[]): FilterOption[] {
  return [...items]
    .sort((a, b) => a.department.name.localeCompare(b.department.name, LOCALE))
    .map((item) => ({ value: String(item.department.id), label: item.department.name }));
}

// Filtre dugmesinin yazisi: secim yok, tek birim ya da kac birim secili
export function departmentFilterSummary(selected: readonly string[], options: readonly FilterOption[]): string {
  if (selected.length === 0) {
    return "Birimler: Tümü";
  }
  if (selected.length === 1) {
    return `Birimler: ${options.find((option) => option.value === selected[0])?.label ?? "1 seçili"}`;
  }
  return `Birimler: ${selected.length} seçili`;
}

export function shownDepartments(shown: number, total: number): string {
  return shown === total ? `${total} birim` : `${total} birimden ${shown}'si gösteriliyor`;
}

export const DEPARTMENTS_PATH = "/manager/departments";

// Varsayilan donem (7 gun) adrese yazilmaz; 30 gun secildiyse detayda da 30 gun acilir
export function departmentPath(id: number, period: SummaryPeriod): string {
  return period === "7d" ? `${DEPARTMENTS_PATH}/${id}` : `${DEPARTMENTS_PATH}/${id}?period=${period}`;
}

// ?period= adresten okunur; elle yazilmis ya da tekrarlanmis deger varsayilan doneme duser
export function periodFromParam(value: string | string[] | undefined): SummaryPeriod {
  return value === "30d" ? "30d" : "7d";
}
