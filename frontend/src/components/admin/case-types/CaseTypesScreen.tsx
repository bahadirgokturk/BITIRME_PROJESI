"use client";

import { useState } from "react";

import { cn } from "cn";

import { ErrorState } from "@/components/states/ErrorState";
import { useAdminCaseTypes } from "@/hooks/useAdminCaseTypes";
import { useAdminDepartments } from "@/hooks/useAdminDepartments";
import {
  filterCaseTypes,
  NO_CASE_TYPE_FILTERS,
  selectableDepartments,
  type CaseCategory,
  type CaseTypeFilters as Filters,
} from "@/lib/adminCaseTypes";
import { CATEGORY_LABELS } from "@/lib/reports";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader } from "../AdminParts";
import { AdminSections } from "../AdminSections";
import { FILTER_FIELD_CLASS, SearchFilters } from "../SearchFilters";
import { CaseTypeSheet, type CaseTypeTarget } from "./CaseTypeSheet";
import { CaseTypesTable } from "./CaseTypesTable";

type CaseTypesQuery = ReturnType<typeof useAdminCaseTypes>;
type Departments = ReturnType<typeof useAdminDepartments>["data"];

const ALL = "";

interface BodyProps {
  query: CaseTypesQuery;
  filters: Filters;
  departments: Departments;
  onEdit: (target: CaseTypeTarget) => void;
  onClear: () => void;
}

function CaseTypesBody({ query, filters, departments, onEdit, onClear }: BodyProps) {
  if (query.isPending) {
    return <ListSkeleton label="Bildirim türleri yükleniyor" />;
  }
  if (query.isError) {
    return <ErrorState title="Bildirim türleri yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  const shown = filterCaseTypes(query.data, filters);
  const active = query.data.filter((caseType) => caseType.is_active).length;
  return (
    <div className="space-y-3">
      {shown.length === 0 ? (
        <NoMatch title="Aramanıza uyan tür yok." onClear={onClear} />
      ) : (
        <CaseTypesTable
          caseTypes={shown}
          departments={departments}
          onEdit={(caseType) => onEdit({ mode: "edit", caseType })}
        />
      )}
      <p className="text-sm text-muted-foreground">
        {query.data.length} tür · {active} aktif
      </p>
    </div>
  );
}

interface CategoryFilterProps {
  value: CaseCategory | null;
  onChange: (category: CaseCategory | null) => void;
}

function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <select
      aria-label="Kategori"
      value={value ?? ALL}
      onChange={(event) => onChange((event.target.value || null) as CaseCategory | null)}
      className={cn(FILTER_FIELD_CLASS, "w-full md:w-52")}
    >
      <option value={ALL}>Tüm kategoriler</option>
      {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
        <option key={category} value={category}>
          {label}
        </option>
      ))}
    </select>
  );
}

const DESCRIPTION =
  "Bildirimlerin ayrıldığı türler. Her türün hangi birime gideceğini, önceliğini ve yapay zekânın tanıdığı anahtar kelimeleri buradan yönetirsiniz.";

// Yonetim > Bildirim Turleri (docs/UI_GUIDE.md bolum 5.5): arama + suzgec + tablo + sagdan acilan panel
export function CaseTypesScreen() {
  const caseTypes = useAdminCaseTypes();
  const departments = useAdminDepartments();
  const [filters, setFilters] = useState<Filters>(NO_CASE_TYPE_FILTERS);
  const [target, setTarget] = useState<CaseTypeTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  function done(message: string) {
    setTarget(null);
    setLastAction(message);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active="/admin/case-types" />
      <ScreenHeader title="Bildirim Türleri" description={DESCRIPTION} addLabel="Tür ekle" onAdd={() => setTarget({ mode: "create" })} />
      <ActionNote message={lastAction} />
      <SearchFilters searchLabel="Tür ara" placeholder="Tür adı, kod ya da anahtar kelime ara" value={filters} onChange={setFilters}>
        <CategoryFilter value={filters.category} onChange={(category) => setFilters({ ...filters, category })} />
      </SearchFilters>
      <CaseTypesBody
        query={caseTypes}
        filters={filters}
        departments={departments.data}
        onEdit={setTarget}
        onClear={() => setFilters(NO_CASE_TYPE_FILTERS)}
      />
      {target ? (
        <CaseTypeSheet
          key={target.mode === "edit" ? target.caseType.id : "new"}
          target={target}
          departments={selectableDepartments(departments.data ?? [], target.mode === "edit" ? target.caseType : null)}
          onClose={() => setTarget(null)}
          onDone={done}
        />
      ) : null}
    </div>
  );
}
