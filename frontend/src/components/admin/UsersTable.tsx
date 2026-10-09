import { cn } from "cn";

import type { AdminUser } from "@/hooks/useAdminUsers";
import { userAssignment } from "@/lib/admin";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/shell";

interface UsersTableProps {
  users: AdminUser[];
  departments: readonly { id: number; name: string }[];
  onEdit: (user: AdminUser) => void;
}

const HEAD_CLASS = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";
// Telefonda her satir bir kart: ad ve durum ustte, diger degerler basliklariyla alt alta (tek DOM, iki yerlesim)
const ROW_CLASS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border bg-card p-3.5 " +
  "md:table-row md:rounded-none md:border-0 md:border-t md:bg-transparent";
const CELL_CLASS = "md:px-4 md:py-3 md:align-middle";
// Telefonda sutun basligi degerin ustune yazilir (data-label); masaustunde baslik satiri gorunur
const LABELLED_CLASS =
  "before:block before:text-xs before:text-muted-foreground before:content-[attr(data-label)] md:before:hidden";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "Aktif" : "Pasif"}
    </span>
  );
}

function LastLogin({ value }: { value: string | null }) {
  if (value === null) {
    return <span className="text-muted-foreground">Hiç giriş yapmadı</span>;
  }
  return (
    <time dateTime={value} title={formatDateTime(value)}>
      {relativeTime(value)}
    </time>
  );
}

const COLUMNS = ["Ad soyad", "Rol", "Birim / tür", "Son giriş", "Durum"];

interface UserRowProps {
  user: AdminUser;
  departments: readonly { id: number; name: string }[];
  onEdit: (user: AdminUser) => void;
}

function UserRow({ user, departments, onEdit }: UserRowProps) {
  return (
    <tr className={cn(ROW_CLASS, !user.is_active && "text-muted-foreground")}>
      <td className={CELL_CLASS}>
        <p className="font-medium">{user.full_name}</p>
        <p className="text-xs break-all text-muted-foreground">{user.email}</p>
      </td>
      <td data-label="Rol" className={cn(CELL_CLASS, LABELLED_CLASS, "col-span-2")}>
        {ROLE_LABELS[user.role]}
      </td>
      <td data-label="Birim / tür" className={cn(CELL_CLASS, LABELLED_CLASS, "col-span-2")}>
        {userAssignment(user, departments)}
      </td>
      <td data-label="Son giriş" className={cn(CELL_CLASS, LABELLED_CLASS)}>
        <LastLogin value={user.last_login_at} />
      </td>
      {/* Telefonda durum rozeti kartin sag ust kosesinde, adin karsisinda durur */}
      <td className={cn(CELL_CLASS, "col-start-2 row-start-1 justify-self-end")}>
        <StatusBadge active={user.is_active} />
      </td>
      <td className={cn(CELL_CLASS, "justify-self-end md:text-right")}>
        <button
          type="button"
          aria-label={`${user.full_name} kullanıcısını düzenle`}
          onClick={() => onEdit(user)}
          className="min-h-11 px-2 font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Düzenle
        </button>
      </td>
    </tr>
  );
}

// Kullanici tablosu (Figma: 06 Admin > /admin/users): masaustunde klasik tablo, telefonda her satir bir kart.
// Pasif kullanici soluk ama okunur.
export function UsersTable({ users, departments, onEdit }: UsersTableProps) {
  return (
    <div className="md:overflow-x-auto md:rounded-xl md:border">
      <table aria-label="Kullanıcılar" className="block w-full text-sm md:table">
        <thead className="hidden bg-muted md:table-header-group">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={HEAD_CLASS}>
                {column}
              </th>
            ))}
            <th className={HEAD_CLASS}>
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody className="grid gap-3 md:table-row-group">
          {users.map((user) => (
            <UserRow key={user.id} user={user} departments={departments} onEdit={onEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
