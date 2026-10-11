import type { ReactNode } from "react";

import { cn } from "cn";

import type { StatusFilter } from "@/lib/admin";

export const FILTER_FIELD_CLASS =
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

interface SearchFiltersProps<T extends Filters> {
  // Arama kutusunun ekran okuyucu adi (ornek: "Birim ara")
  searchLabel: string;
  placeholder: string;
  value: T;
  onChange: (filters: T) => void;
  // Arama ile durum arasina girecek ek suzgec (ornek: kategori)
  children?: ReactNode;
}

// Arama + durum suzgeci (Figma: 06 Admin); suzme tarayicida yapilir
export function SearchFilters<T extends Filters>(props: SearchFiltersProps<T>) {
  const { searchLabel, placeholder, value, onChange, children } = props;
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <input
        type="search"
        aria-label={searchLabel}
        placeholder={placeholder}
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        className={cn(FILTER_FIELD_CLASS, "w-full md:flex-1")}
      />
      {children}
      <select
        aria-label="Durum"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as StatusFilter })}
        className={cn(FILTER_FIELD_CLASS, "w-full md:w-44")}
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
