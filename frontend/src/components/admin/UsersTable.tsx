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
const CELL_CLASS = "px-4 py-3 align-middle";

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
    <tr className={cn("border-t", !user.is_active && "text-muted-foreground")}>
      <td className={CELL_CLASS}>
        <p className="font-medium">{user.full_name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </td>
      <td className={CELL_CLASS}>{ROLE_LABELS[user.role]}</td>
      <td className={CELL_CLASS}>{userAssignment(user, departments)}</td>
      <td className={CELL_CLASS}>
        <LastLogin value={user.last_login_at} />
      </td>
      <td className={CELL_CLASS}>
        <StatusBadge active={user.is_active} />
      </td>
      <td className={cn(CELL_CLASS, "text-right")}>
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

// Kullanici tablosu (Figma: 06 Admin > UsersTable); pasif kullanici soluk ama okunur
export function UsersTable({ users, departments, onEdit }: UsersTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} className={HEAD_CLASS}>
                {column}
              </th>
            ))}
            <th className={HEAD_CLASS}>
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow key={user.id} user={user} departments={departments} onEdit={onEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
