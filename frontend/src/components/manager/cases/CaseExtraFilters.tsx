"use client";

import { CheckboxFilter } from "@/components/filters/CheckboxFilter";
import { useBuildings } from "@/hooks/useCases";
import { useDepartments } from "@/hooks/useReview";
import {
  CATEGORY_FILTER_OPTIONS,
  categoryFilterSummary,
  type CaseCategory,
  type CaseFilters as Filters,
} from "@/lib/caseList";

const FIELD_CLASS =
  "h-11 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10";
const LABEL_CLASS = "flex items-center gap-2 text-sm text-muted-foreground";

interface FilterProps {
  value: Filters;
  onChange: (filters: Filters) => void;
}

// Birim secimi: /departments yalniz mudur ve yoneticiye acik; personelin listesi zaten kendi birimi
function DepartmentSelect({ value, onChange }: FilterProps) {
  const departments = useDepartments(true);
  return (
    <select
      aria-label="Birim"
      value={value.departmentId}
      onChange={(event) => onChange({ ...value, departmentId: event.target.value })}
      className={FIELD_CLASS}
    >
      <option value="">Tüm birimler</option>
      {departments.data?.map((department) => (
        <option key={department.id} value={String(department.id)}>
          {department.name}
        </option>
      ))}
    </select>
  );
}

// Bina: secilen binanin kat ve odalarindaki bildirimler de gelir (backend konum alt agaci)
function BuildingSelect({ value, onChange }: FilterProps) {
  const buildings = useBuildings();
  return (
    <select
      aria-label="Bina"
      value={value.locationId}
      onChange={(event) => onChange({ ...value, locationId: event.target.value })}
      className={FIELD_CLASS}
    >
      <option value="">Tüm binalar</option>
      {buildings.data?.map((building) => (
        <option key={building.id} value={String(building.id)}>
          {building.name}
        </option>
      ))}
    </select>
  );
}

// Acilis gunu araligi, iki uc dahil; baslangic bitisten sonra secilemez (backend de 422 doner)
function DateRange({ value, onChange }: FilterProps) {
  return (
    <>
      <label className={LABEL_CLASS}>
        Açılış
        <input
          type="date"
          aria-label="Başlangıç tarihi"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          className={FIELD_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        –
        <input
          type="date"
          aria-label="Bitiş tarihi"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          className={FIELD_CLASS}
        />
      </label>
    </>
  );
}

// Birim, bina, kategori ve tarih suzgecleri (docs/API.md "Cases"); unit: personelin birim listesi, birim secimi yok
export function CaseExtraFilters({ value, onChange, unit }: FilterProps & { unit: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:flex md:flex-wrap md:items-center">
      {unit ? null : <DepartmentSelect value={value} onChange={onChange} />}
      <BuildingSelect value={value} onChange={onChange} />
      <CheckboxFilter
        label="Kategoriler"
        summary={categoryFilterSummary(value.categories)}
        options={CATEGORY_FILTER_OPTIONS}
        selected={value.categories}
        onChange={(categories) => onChange({ ...value, categories: categories as CaseCategory[] })}
      />
      <DateRange value={value} onChange={onChange} />
    </div>
  );
}
