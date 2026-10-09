"use client";

import { useState } from "react";

import { ErrorState } from "@/components/states/ErrorState";
import { useAdminDepartments } from "@/hooks/useAdminDepartments";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  filterDepartments,
  memberCounts,
  NO_DEPARTMENT_FILTERS,
  type DepartmentFilters as Filters,
} from "@/lib/adminDepartments";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader } from "../AdminParts";
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
    <div className="space-y-3">
      {shown.length === 0 ? (
        <NoMatch title="Aramanıza uyan birim yok." onClear={onClear} />
      ) : (
        <DepartmentsTable
          departments={shown}
          counts={counts}
          onEdit={(department) => onEdit({ mode: "edit", department })}
        />
      )}
      <p className="text-sm text-muted-foreground">
        {query.data.length} birim · {active} aktif
      </p>
    </div>
  );
}

// Yonetim > Birimler (docs/UI_GUIDE.md bolum 5.5): arama + suzgec + tablo + sagdan acilan panel
export function DepartmentsScreen() {
  const departments = useAdminDepartments();
  const users = useAdminUsers();
  const [filters, setFilters] = useState<Filters>(NO_DEPARTMENT_FILTERS);
  const [target, setTarget] = useState<DepartmentTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  function done(message: string) {
    setTarget(null);
    setLastAction(message);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active="/admin/departments" />
      <ScreenHeader
        title="Birimler"
        description="Bildirimlerin yönlendirildiği birimler. Yeni birim ekleyebilir, adını düzenleyebilir ya da birimi pasifleştirebilirsiniz."
        addLabel="Birim ekle"
        onAdd={() => setTarget({ mode: "create" })}
      />
      <ActionNote message={lastAction} />
      <SearchFilters searchLabel="Birim ara" placeholder="Birim adı ya da kod ara" value={filters} onChange={setFilters} />
      <DepartmentsBody
        query={departments}
        filters={filters}
        counts={users.data ? memberCounts(users.data) : null}
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
