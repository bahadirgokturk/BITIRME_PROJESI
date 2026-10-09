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
  onClear: () => void;
}

// Liste hic bos olmaz (en az bir yonetici vardir); bos gorunuyorsa sebep suzgeclerdir
function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Aramanıza uyan kullanıcı yok.</p>
      <p className="text-sm text-muted-foreground">Farklı bir kelime deneyin ya da süzgeçleri temizleyin.</p>
      <Button variant="outline" className="mt-2 h-11 px-4" onClick={onClear}>
        Süzgeçleri temizle
      </Button>
    </div>
  );
}

function UsersBody({ query, filters, departments, onEdit, onClear }: BodyProps) {
  if (query.isPending) {
    return (
      <div aria-label="Kullanıcılar yükleniyor" aria-busy="true" className="grid gap-3 md:rounded-xl md:border md:p-4">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-28 w-full md:h-5" />
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
    <div className="space-y-3">
      {shown.length === 0 ? (
        <NoMatch onClear={onClear} />
      ) : (
        <UsersTable users={shown} departments={departments} onEdit={(user) => onEdit({ mode: "edit", user })} />
      )}
      <p className="text-sm text-muted-foreground">
        {query.data.length} kullanıcı · {active} aktif
      </p>
    </div>
  );
}

function ScreenHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <header className="space-y-2">
      <div className="flex items-end justify-between gap-4">
        <PageTitle>Kullanıcılar</PageTitle>
        <Button className="h-11 px-4" onClick={onAdd}>
          Kullanıcı ekle
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Sistemdeki bütün hesaplar. Yeni kullanıcı ekleyebilir, bilgilerini düzenleyebilir ya da hesabı
        pasifleştirebilirsiniz.
      </p>
    </header>
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
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active="/admin/users" />
      <ScreenHeader onAdd={() => setTarget({ mode: "create" })} />
      <p role="status" className={lastAction ? "rounded-md bg-muted px-3 py-2 text-sm" : "sr-only"}>
        {lastAction}
      </p>
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
