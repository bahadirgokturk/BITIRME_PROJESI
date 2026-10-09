import { cn } from "cn";

import type { StatusFilter } from "@/lib/admin";

const FIELD_CLASS =
  "h-11 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Tüm durumlar",
  active: "Aktif",
  inactive: "Pasif",
};

interface Filters {
  search: string;
  status: StatusFilter;
}

interface SearchFiltersProps {
  // Arama kutusunun ekran okuyucu adi (ornek: "Birim ara")
  searchLabel: string;
  placeholder: string;
  value: Filters;
  onChange: (filters: Filters) => void;
}

// Arama + durum suzgeci (Figma: 06 Admin); suzme tarayicida yapilir
export function SearchFilters({ searchLabel, placeholder, value, onChange }: SearchFiltersProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <input
        type="search"
        aria-label={searchLabel}
        placeholder={placeholder}
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        className={cn(FIELD_CLASS, "w-full md:flex-1")}
      />
      <select
        aria-label="Durum"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as StatusFilter })}
        className={cn(FIELD_CLASS, "w-full md:w-44")}
      >
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <option key={status} value={status}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
