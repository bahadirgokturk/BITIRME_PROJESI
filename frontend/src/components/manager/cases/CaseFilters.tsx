import { cn } from "cn";

import { FilterChips } from "@/components/filters/FilterChips";
import { STATUS_GROUPS, type CaseFilters as Filters } from "@/lib/caseList";
import { PRIORITY_LABELS, type Priority } from "@/lib/tasks";

// En acil en ustte
const PRIORITY_OPTIONS: readonly Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const ALL_PRIORITIES = "";
const FIELD_CLASS =
  "h-11 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10";

interface CaseFiltersProps {
  value: Filters;
  onChange: (filters: Filters) => void;
}

// Arama, oncelik ve durum grubu filtreleri (Figma: 05 Manager > /manager/cases)
export function CaseFilters({ value, onChange }: CaseFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          type="search"
          aria-label="Bildirim ara"
          placeholder="Bildirim numarası, başlık ya da konum ara"
          enterKeyHint="search"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          className={cn(FIELD_CLASS, "w-full md:flex-1")}
        />
        <select
          aria-label="Öncelik"
          value={value.priority ?? ALL_PRIORITIES}
          onChange={(event) => onChange({ ...value, priority: (event.target.value || null) as Priority | null })}
          className={cn(FIELD_CLASS, "w-full md:w-52")}
        >
          <option value={ALL_PRIORITIES}>Tüm öncelikler</option>
          {PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </div>
      <FilterChips
        label="Durum"
        options={STATUS_GROUPS}
        value={value.group}
        onChange={(group) => onChange({ ...value, group })}
      />
    </div>
  );
}
