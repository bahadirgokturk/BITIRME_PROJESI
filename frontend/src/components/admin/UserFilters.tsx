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
  departments: readonly { id: number; name: string }[];
  onChange: (filters: Filters) => void;
}

const idOrNull = (value: string) => (value ? Number(value) : null);

function Options({ entries }: { entries: readonly (readonly [string, string])[] }) {
  return entries.map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
}

// Arama + rol + birim + durum (Figma: 06 Admin > Filters); suzme sunucuda yapilir (lib/admin.ts userListPath)
export function UserFilters({ value, departments, onChange }: UserFiltersProps) {
  const departmentOptions = departments.map((department) => [String(department.id), department.name] as const);
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
      <SearchInput
        aria-label="Kullanıcı ara"
        placeholder="Ad ya da e-posta ara"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        className="w-full md:w-72"
      />
      <FilterSelect
        aria-label="Rol"
        value={value.role ?? ALL}
        onChange={(event) => onChange({ ...value, role: (event.target.value || null) as Role | null })}
        className="w-full md:w-44"
      >
        <Options entries={[[ALL, "Tüm roller"], ...Object.entries(ROLE_LABELS)]} />
      </FilterSelect>
      <FilterSelect
        aria-label="Birim"
        value={value.departmentId === null ? ALL : String(value.departmentId)}
        onChange={(event) => onChange({ ...value, departmentId: idOrNull(event.target.value) })}
        className="w-full md:w-56"
      >
        <Options entries={[[ALL, "Tüm birimler"], ...departmentOptions]} />
      </FilterSelect>
      <FilterSelect
        aria-label="Durum"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as StatusFilter })}
        className="w-full md:w-44"
      >
        <Options entries={Object.entries(STATUS_LABELS)} />
      </FilterSelect>
    </div>
  );
}
