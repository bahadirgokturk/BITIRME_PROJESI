"use client";

import { useState } from "react";

import { ErrorState } from "@/components/states/ErrorState";
import { useAdminDepartments } from "@/hooks/useAdminDepartments";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { filterUsers, type UserFilters as Filters } from "@/lib/admin";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader } from "./AdminParts";
import { AdminSections } from "./AdminSections";
import { UserFilters } from "./UserFilters";
import { UserSheet, type SheetTarget } from "./UserSheet";
import { UsersTable } from "./UsersTable";

const NO_FILTERS: Filters = { search: "", role: null, status: "all" };

type UsersQuery = ReturnType<typeof useAdminUsers>;

interface BodyProps {
  query: UsersQuery;
  filters: Filters;
  departments: readonly { id: number; name: string }[];
  onEdit: (target: SheetTarget) => void;
  onClear: () => void;
}

function UsersBody({ query, filters, departments, onEdit, onClear }: BodyProps) {
  if (query.isPending) {
    return <ListSkeleton label="Kullanıcılar yükleniyor" />;
  }
  if (query.isError) {
    return <ErrorState title="Kullanıcılar yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  const shown = filterUsers(query.data, filters);
  const active = query.data.filter((user) => user.is_active).length;
  return (
    <div className="space-y-3">
      {/* Liste hic bos olmaz (en az bir yonetici vardir); bos gorunuyorsa sebep suzgeclerdir */}
      {shown.length === 0 ? (
        <NoMatch title="Aramanıza uyan kullanıcı yok." onClear={onClear} />
      ) : (
        <UsersTable users={shown} departments={departments} onEdit={(user) => onEdit({ mode: "edit", user })} />
      )}
      <p className="text-sm text-muted-foreground">
        {query.data.length} kullanıcı · {active} aktif
      </p>
    </div>
  );
}

// Yonetim > Kullanicilar (docs/UI_GUIDE.md bolum 5.5): arama + suzgec + tablo + sagdan acilan panel
export function UsersScreen() {
  const users = useAdminUsers();
  const departments = useAdminDepartments();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  function done(message: string) {
    setTarget(null);
    setLastAction(message);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active="/admin/users" />
      <ScreenHeader
        title="Kullanıcılar"
        description="Sistemdeki bütün hesaplar. Yeni kullanıcı ekleyebilir, bilgilerini düzenleyebilir ya da hesabı pasifleştirebilirsiniz."
        addLabel="Kullanıcı ekle"
        onAdd={() => setTarget({ mode: "create" })}
      />
      <ActionNote message={lastAction} />
      <UserFilters value={filters} onChange={setFilters} />
      <UsersBody query={users} filters={filters} departments={departments.data ?? []} onEdit={setTarget} onClear={() => setFilters(NO_FILTERS)} />
      {target ? (
        <UserSheet
          key={target.mode === "edit" ? target.user.id : "new"}
          target={target}
          departments={(departments.data ?? []).filter((department) => department.is_active)}
          onClose={() => setTarget(null)}
          onDone={done}
        />
      ) : null}
    </div>
  );
}
