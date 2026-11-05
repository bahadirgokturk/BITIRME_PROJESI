import { FunnelIcon, SearchIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "cn";

import type { StatusFilter } from "@/lib/admin";

export const FILTER_FIELD_CLASS =
  "h-11 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10";

const ICON_CLASS = "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground";

// Arama kutusu, solunda buyutec (Figma: 08 Yeni Stil (A) > Yonetim); genislik className ile disaridan verilir
export function SearchInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon aria-hidden className={ICON_CLASS} />
      <input type="search" {...props} className={cn(FILTER_FIELD_CLASS, "w-full pl-9")} />
    </div>
  );
}

// Suzgec secimi, solunda huni; secenekler yerel select ile acilir (telefonda sistem secicisi)
export function FilterSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <FunnelIcon aria-hidden className={ICON_CLASS} />
      <select {...props} className={cn(FILTER_FIELD_CLASS, "w-full pl-9 font-medium")} />
    </div>
  );
}

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
      <SearchInput
        aria-label={searchLabel}
        placeholder={placeholder}
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        className="w-full md:w-80"
      />
      {children}
      <FilterSelect
        aria-label="Durum"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as StatusFilter })}
        className="w-full md:w-44"
      >
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <option key={status} value={status}>
            {label}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}
