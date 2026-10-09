import { cn } from "cn";

import type { AdminUser } from "@/hooks/useAdminUsers";
import { userAssignment } from "@/lib/admin";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/shell";

import { ActiveBadge } from "./AdminParts";
import { AdminTable, BADGE_CELL_CLASS, CELL_CLASS, EDIT_BUTTON_CLASS, LABELLED_CLASS, ROW_CLASS } from "./AdminTable";

interface UsersTableProps {
  users: AdminUser[];
  departments: readonly { id: number; name: string }[];
  onEdit: (user: AdminUser) => void;
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
      <td className={cn(CELL_CLASS, BADGE_CELL_CLASS)}>
        <ActiveBadge active={user.is_active} />
      </td>
      <td className={cn(CELL_CLASS, "justify-self-end md:text-right")}>
        <button
          type="button"
          aria-label={`${user.full_name} kullanıcısını düzenle`}
          onClick={() => onEdit(user)}
          className={EDIT_BUTTON_CLASS}
        >
          Düzenle
        </button>
      </td>
    </tr>
  );
}

// Kullanici tablosu (Figma: 06 Admin > /admin/users); pasif kullanici soluk ama okunur
export function UsersTable({ users, departments, onEdit }: UsersTableProps) {
  return (
    <AdminTable label="Kullanıcılar" columns={COLUMNS}>
      {users.map((user) => (
        <UserRow key={user.id} user={user} departments={departments} onEdit={onEdit} />
      ))}
    </AdminTable>
  );
}
