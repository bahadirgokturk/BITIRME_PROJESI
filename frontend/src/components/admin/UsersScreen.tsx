"use client";

import { useState } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminDepartments, useAdminUsers } from "@/hooks/useAdminUsers";
import { filterUsers, type UserFilters as Filters } from "@/lib/admin";

import { AdminSections } from "./AdminSections";
import { UserFilters } from "./UserFilters";
import { UserSheet, type SheetTarget } from "./UserSheet";
import { UsersTable } from "./UsersTable";

// Iskelet satir sayisi: tasarimdaki ornek tablo kadar (Figma: /admin/users - yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"];
const NO_FILTERS: Filters = { search: "", role: null, status: "all" };

type UsersQuery = ReturnType<typeof useAdminUsers>;

interface BodyProps {
  query: UsersQuery;
  filters: Filters;
  departments: readonly { id: number; name: string }[];
  onEdit: (target: SheetTarget) => void;
}

function UsersBody({ query, filters, departments, onEdit }: BodyProps) {
  if (query.isPending) {
    return (
      <div aria-label="Kullanıcılar yükleniyor" aria-busy="true" className="space-y-3 rounded-xl border p-4">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState title="Kullanıcılar yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  const shown = filterUsers(query.data, filters);
  const active = query.data.filter((user) => user.is_active).length;
  return (
    <div className="space-y-2">
      {shown.length === 0 ? (
        <p className="rounded-xl border py-12 text-center text-sm text-muted-foreground">Aramaya uyan kullanıcı yok.</p>
      ) : (
        <UsersTable users={shown} departments={departments} onEdit={(user) => onEdit({ mode: "edit", user })} />
      )}
      <p className="text-xs text-muted-foreground">
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
  // Son islemin sonucu ekran okuyucuya da duyurulur
  const [lastAction, setLastAction] = useState<string | null>(null);

  function done(message: string) {
    setTarget(null);
    setLastAction(message);
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5">
      <AdminSections active="/admin/users" />
      <header className="flex items-end justify-between gap-4">
        <PageTitle>Kullanıcılar</PageTitle>
        <Button className="h-11 px-4" onClick={() => setTarget({ mode: "create" })}>
          Kullanıcı ekle
        </Button>
      </header>
      <p role="status" className={lastAction ? "rounded-md bg-muted px-3 py-2 text-sm" : "sr-only"}>
        {lastAction}
      </p>
      <UserFilters value={filters} onChange={setFilters} />
      <UsersBody query={users} filters={filters} departments={departments.data ?? []} onEdit={setTarget} />
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
