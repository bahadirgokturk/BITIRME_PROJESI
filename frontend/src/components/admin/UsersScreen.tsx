"use client";

import { useState } from "react";

import { ExportButton } from "@/components/export/ExportButton";
import { ErrorState } from "@/components/states/ErrorState";
import { useAdminDepartments } from "@/hooks/useAdminDepartments";
import { fetchAllUsers, USER_PAGE_SIZE, useUserSearch } from "@/hooks/useAdminUsers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { UserFilters as Filters } from "@/lib/admin";
import { usersSheet } from "@/lib/exportSheets";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader, Toolbar } from "./AdminParts";
import { AdminSections } from "./AdminSections";
import { Pager } from "./Pager";
import { UserFilters } from "./UserFilters";
import { UserImportDialog } from "./UserImportDialog";
import { UserSheet, type SheetTarget } from "./UserSheet";
import { UsersTable } from "./UsersTable";

const NO_FILTERS: Filters = { search: "", role: null, departmentId: null, status: "all" };
const DESCRIPTION =
  "Sistemdeki bütün hesaplar. Yeni kullanıcı ekleyebilir, bilgilerini düzenleyebilir " +
  "ya da hesabı pasifleştirebilirsiniz.";
// Yazarken her harfte istek gitmesin (yonetici bildirim listesindeki aramayla ayni)
const SEARCH_DELAY_MS = 300;

type Departments = readonly { id: number; name: string }[];

interface BodyProps {
  query: ReturnType<typeof useUserSearch>;
  page: number;
  departments: Departments;
  onPage: (page: number) => void;
  onEdit: (target: SheetTarget) => void;
  onClear: () => void;
}

function UsersBody({ query, page, departments, onPage, onEdit, onClear }: BodyProps) {
  if (query.isPending) {
    return <ListSkeleton label="Kullanıcılar yükleniyor" />;
  }
  if (query.isError) {
    return <ErrorState title="Kullanıcılar yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  // Liste hic bos olmaz (en az bir yonetici vardir); bos gorunuyorsa sebep suzgeclerdir
  if (query.data.items.length === 0) {
    return <NoMatch title="Aramanıza uyan kullanıcı yok." onClear={onClear} />;
  }
  return (
    <UsersTable
      users={query.data.items}
      departments={departments}
      onEdit={(user) => onEdit({ mode: "edit", user })}
      footer={
        <Pager page={page} pageSize={USER_PAGE_SIZE} total={query.data.total} unit="kullanıcı" onPage={onPage} />
      }
    />
  );
}

// Arama kutusu yazarken degisir; sunucuya kisa bir beklemeden sonra gider. Suzgec degisince ilk sayfaya donulur.
function useUserListState() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(filters.search, SEARCH_DELAY_MS);
  const applied: Filters = { ...filters, search };
  const query = useUserSearch(applied, page);
  function changeFilters(next: Filters) {
    setFilters(next);
    setPage(1);
  }
  return { filters, applied, page, query, setPage, changeFilters };
}

// Yonetim > Kullanicilar (docs/UI_GUIDE.md bolum 5.5): arama + suzgec sunucuda, sayfali tablo, sagdan panel
export function UsersScreen() {
  const list = useUserListState();
  const departments = useAdminDepartments().data ?? [];
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  function done(message: string) {
    setTarget(null);
    setLastAction(message);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active="/admin/users" />
      <UsersHeader onAdd={() => setTarget({ mode: "create" })} onImported={done} />
      <ActionNote message={lastAction} />
      <Toolbar
        action={<UsersExport filters={list.filters} departments={departments} empty={!list.query.data?.total} />}
      >
        <UserFilters value={list.filters} departments={departments} onChange={list.changeFilters} />
      </Toolbar>
      <UsersBody
        query={list.query}
        page={list.page}
        departments={departments}
        onPage={list.setPage}
        onEdit={setTarget}
        onClear={() => list.changeFilters(NO_FILTERS)}
      />
      {target ? (
        <UserSheet
          key={target.mode === "edit" ? target.user.id : "new"}
          target={target}
          departments={departments.filter((department) => department.is_active)}
          onClose={() => setTarget(null)}
          onDone={done}
        />
      ) : null}
    </div>
  );
}

// Ekle dugmesinin solunda toplu yukleme
function UsersHeader({ onAdd, onImported }: { onAdd: () => void; onImported: (message: string) => void }) {
  return (
    <ScreenHeader
      title="Kullanıcılar"
      description={DESCRIPTION}
      addLabel="Kullanıcı ekle"
      onAdd={onAdd}
      extra={<UserImportDialog onDone={onImported} />}
    />
  );
}

// Ayni suzgece uyan butun kullanicilar aktarilir (yalniz ekrandaki sayfa degil)
function UsersExport({ filters, departments, empty }: { filters: Filters; departments: Departments; empty: boolean }) {
  return (
    <ExportButton
      fileName="kullanicilar"
      disabled={empty}
      load={async () => usersSheet(await fetchAllUsers(filters), departments)}
    />
  );
}
