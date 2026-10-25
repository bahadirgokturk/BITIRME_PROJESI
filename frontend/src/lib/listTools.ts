// Liste araclari (Bildirimlerim, Gorevlerim, Tum Bildirimler; docs/UI_GUIDE.md bolum 5): tikli oncelik
// filtresi, siralama ve liste/kart gorunumu. Backend: priority tekrarlanir, order=newest|oldest (docs/API.md).
import type { FilterOption } from "@/lib/filters";
import { PRIORITY_LABELS, type Priority } from "@/lib/tasks";

// En acil en ustte
const PRIORITIES: readonly Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const PRIORITY_FILTER_OPTIONS: readonly FilterOption[] = PRIORITIES.map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

// Filtre dugmesinin yazisi: secim yok, tek oncelik ya da kac oncelik secili
export function priorityFilterSummary(selected: readonly string[]): string {
  if (selected.length === 0) {
    return "Öncelik: Tümü";
  }
  if (selected.length === 1) {
    return `Öncelik: ${PRIORITY_LABELS[selected[0] as Priority] ?? "1 seçili"}`;
  }
  return `Öncelik: ${selected.length} seçili`;
}

// "urgent" yalniz gorevlerde: order gonderilmez, backend SLA hedefi en yakin olani one alir
export type ListOrder = "newest" | "oldest" | "urgent";

export interface OrderOption {
  value: ListOrder;
  label: string;
}

export const CASE_ORDERS: readonly OrderOption[] = [
  { value: "newest", label: "En yeni" },
  { value: "oldest", label: "En eski" },
];

export const TASK_ORDERS: readonly OrderOption[] = [{ value: "urgent", label: "En acil" }, ...CASE_ORDERS];

export type ListView = "list" | "grid";

export interface ListTools {
  priorities: readonly Priority[];
  order: ListOrder;
}

// Oncelik her secim icin tekrarlanir; "en acil" backend varsayilani oldugundan yazilmaz
export function listParams({ priorities, order }: ListTools, params = new URLSearchParams()): URLSearchParams {
  priorities.forEach((priority) => params.append("priority", priority));
  if (order !== "urgent") {
    params.set("order", order);
  }
  return params;
}

const ORDER_NOTE: Record<ListOrder, string> = {
  urgent: "en acil olan üstte",
  newest: "en yeni olan üstte",
  oldest: "en eski olan üstte",
};

// Gorevlerim basliginin altindaki satir: kac gorev ve hangi sira
export function taskListSummary(count: number, order: ListOrder): string {
  return `${count} açık görev · ${ORDER_NOTE[order]}`;
}
