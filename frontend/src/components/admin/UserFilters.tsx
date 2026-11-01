import type { Role, StatusFilter, UserFilters as Filters } from "@/lib/admin";
import { ROLE_LABELS } from "@/lib/shell";

import { FilterSelect, SearchInput } from "./SearchFilters";

const ALL = "";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Tüm durumlar",
  active: "Aktif",
  inactive: "Pasif",
};

interface UserFiltersProps {
  value: Filters;
  onChange: (filters: Filters) => void;
}

// Arama + rol + durum (Figma: 06 Admin > Filters); suzme tarayicida yapilir (lib/admin.ts filterUsers)
export function UserFilters({ value, onChange }: UserFiltersProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <SearchInput
        aria-label="Kullanıcı ara"
        placeholder="Ad ya da e-posta ara"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        className="w-full md:w-80"
      />
      <FilterSelect
        aria-label="Rol"
        value={value.role ?? ALL}
        onChange={(event) => onChange({ ...value, role: (event.target.value || null) as Role | null })}
        className="w-full md:w-52"
      >
        <option value={ALL}>Tüm roller</option>
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <option key={role} value={role}>
            {label}
          </option>
        ))}
      </FilterSelect>
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
