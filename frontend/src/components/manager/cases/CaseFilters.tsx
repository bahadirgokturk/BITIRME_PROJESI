import { cn } from "cn";

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

function StatusGroups({ value, onChange }: CaseFiltersProps) {
  return (
    <div role="group" aria-label="Durum" className="flex flex-wrap gap-2">
      {STATUS_GROUPS.map((group) => (
        <button
          key={group.value}
          type="button"
          aria-pressed={group.value === value.group}
          onClick={() => onChange({ ...value, group: group.value })}
          className={cn(
            "h-11 rounded-full border bg-background px-3.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9",
            group.value === value.group && "border-primary bg-primary font-medium text-primary-foreground",
          )}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}

// Arama, oncelik ve durum grubu suzgecleri (Figma: 05 Manager > /manager/cases)
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
      <StatusGroups value={value} onChange={onChange} />
    </div>
  );
}
