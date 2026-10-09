import { cn } from "cn";

import type { Role, StatusFilter, UserFilters as Filters } from "@/lib/admin";
import { ROLE_LABELS } from "@/lib/shell";

const FIELD_CLASS =
  "h-11 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10";
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
      <input
        type="search"
        aria-label="Kullanıcı ara"
        placeholder="Ad ya da e-posta ara"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        className={cn(FIELD_CLASS, "w-full md:flex-1")}
      />
      <select
        aria-label="Rol"
        value={value.role ?? ALL}
        onChange={(event) => onChange({ ...value, role: (event.target.value || null) as Role | null })}
        className={cn(FIELD_CLASS, "w-full md:w-52")}
      >
        <option value={ALL}>Tüm roller</option>
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <option key={role} value={role}>
            {label}
          </option>
        ))}
      </select>
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
