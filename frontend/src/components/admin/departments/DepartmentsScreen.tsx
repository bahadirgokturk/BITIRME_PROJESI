"use client";

import { useState } from "react";

import { ExportButton } from "@/components/export/ExportButton";
import { departmentsSheet } from "@/lib/exportSheets";
import { ErrorState } from "@/components/states/ErrorState";
import { useAdminDepartments } from "@/hooks/useAdminDepartments";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  filterDepartments,
  memberCounts,
  NO_DEPARTMENT_FILTERS,
  type DepartmentFilters as Filters,
} from "@/lib/adminDepartments";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader, Toolbar } from "../AdminParts";
import { AdminSections } from "../AdminSections";
import { SearchFilters } from "../SearchFilters";
import { DepartmentSheet, type DepartmentTarget } from "./DepartmentSheet";
import { DepartmentsTable } from "./DepartmentsTable";

type DepartmentsQuery = ReturnType<typeof useAdminDepartments>;

interface BodyProps {
  query: DepartmentsQuery;
  filters: Filters;
  counts: Map<number, number> | null;
  onEdit: (target: DepartmentTarget) => void;
  onClear: () => void;
}

function DepartmentsBody({ query, filters, counts, onEdit, onClear }: BodyProps) {
  if (query.isPending) {
    return <ListSkeleton label="Birimler yükleniyor" />;
  }
  if (query.isError) {
    return <ErrorState title="Birimler yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  const shown = filterDepartments(query.data, filters);
  const active = query.data.filter((department) => department.is_active).length;
  return (
    <>
      {shown.length === 0 ? (
        <NoMatch title="Aramanıza uyan birim yok." onClear={onClear} />
      ) : (
        <DepartmentsTable
          departments={shown}
          counts={counts}
          onEdit={(department) => onEdit({ mode: "edit", department })}
          footer={`${query.data.length} birim, ${active} aktif`}
        />
      )}
    </>
  );
}

interface ToolbarProps extends Omit<BodyProps, "onEdit" | "onClear"> {
  onChange: (filters: Filters) => void;
}

// Arama + durum solda, ekranda gorunen birimleri aktaran dugme sagda
function DepartmentsToolbar({ query, filters, counts, onChange }: ToolbarProps) {
  const exportButton = (
    <ExportButton
      fileName="birimler"
      disabled={!query.data}
      load={() => departmentsSheet(filterDepartments(query.data ?? [], filters), counts)}
    />
  );
  return (
    <Toolbar action={exportButton}>
      <SearchFilters
        searchLabel="Birim ara"
        placeholder="Birim adı ya da kod ara"
        value={filters}
        onChange={onChange}
      />
    </Toolbar>
  );
}

const DESCRIPTION =
  "Bildirimlerin yönlendirildiği birimler. Yeni birim ekleyebilir, adını düzenleyebilir " +
  "ya da birimi pasifleştirebilirsiniz.";

// Yonetim > Birimler (docs/UI_GUIDE.md bolum 5.5): arama + suzgec + tablo + sagdan acilan panel
export function DepartmentsScreen() {
  const departments = useAdminDepartments();
  const users = useAdminUsers();
  const [filters, setFilters] = useState<Filters>(NO_DEPARTMENT_FILTERS);
  const [target, setTarget] = useState<DepartmentTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const counts = users.data ? memberCounts(users.data) : null;

  function done(message: string) {
    setTarget(null);
    setLastAction(message);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active="/admin/departments" />
      <ScreenHeader
        title="Birimler"
        description={DESCRIPTION}
        addLabel="Birim ekle"
        onAdd={() => setTarget({ mode: "create" })}
      />
      <ActionNote message={lastAction} />
      <DepartmentsToolbar query={departments} filters={filters} counts={counts} onChange={setFilters} />
      <DepartmentsBody
        query={departments}
        filters={filters}
        counts={counts}
        onEdit={setTarget}
        onClear={() => setFilters(NO_DEPARTMENT_FILTERS)}
      />
      {target ? (
        <DepartmentSheet
          key={target.mode === "edit" ? target.department.id : "new"}
          target={target}
          onClose={() => setTarget(null)}
          onDone={done}
        />
      ) : null}
    </div>
  );
}
