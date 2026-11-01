import type { ReactNode } from "react";

import { FilterChips } from "@/components/filters/FilterChips";
import { ListToolbar } from "@/components/lists/ListToolbar";
import { STATUS_GROUPS, type CaseFilters as Filters } from "@/lib/caseList";
import { CASE_ORDERS, type ListView } from "@/lib/listTools";

const SEARCH_CLASS =
  "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10";

interface CaseFiltersProps {
  value: Filters;
  view: ListView;
  onChange: (filters: Filters) => void;
  onView: (view: ListView) => void;
  // Arac satirinda gorunum dugmelerinin solu (Excel'e aktar)
  extra?: ReactNode;
}

// Arama, durum grubu ve liste araclari: tikli oncelik, siralama, liste/kart (Figma: 05 Manager > /manager/cases -
// liste araclari)
export function CaseFilters({ value, view, onChange, onView, extra }: CaseFiltersProps) {
  return (
    <div className="space-y-3">
      <input
        type="search"
        aria-label="Bildirim ara"
        placeholder="Bildirim numarası, başlık ya da konum ara"
        enterKeyHint="search"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        className={SEARCH_CLASS}
      />
      <FilterChips
        label="Durum"
        options={STATUS_GROUPS}
        value={value.group}
        onChange={(group) => onChange({ ...value, group })}
      />
      <ListToolbar
        tools={value}
        orders={CASE_ORDERS}
        view={view}
        onTools={(tools) => onChange({ ...value, ...tools })}
        onView={onView}
        extra={extra}
      />
    </div>
  );
}
