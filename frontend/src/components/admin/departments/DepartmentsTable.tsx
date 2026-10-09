import { cn } from "cn";

import { memberLabel, type Department } from "@/lib/adminDepartments";

import { ActiveBadge } from "../AdminParts";
import { AdminTable, BADGE_CELL_CLASS, CELL_CLASS, EDIT_BUTTON_CLASS, LABELLED_CLASS, ROW_CLASS } from "../AdminTable";

const COLUMNS = ["Birim", "Kod", "Aktif kullanıcı", "Durum"];
// Kullanici listesi henuz gelmediyse sayi yerine gosterilir
const NO_VALUE = "–";

interface DepartmentsTableProps {
  departments: Department[];
  // Birim basina aktif kullanici sayisi; kullanicilar yuklenemediyse null
  counts: Map<number, number> | null;
  onEdit: (department: Department) => void;
}

interface DepartmentRowProps {
  department: Department;
  members: string;
  onEdit: (department: Department) => void;
}

function DepartmentRow({ department, members, onEdit }: DepartmentRowProps) {
  return (
    <tr className={cn(ROW_CLASS, !department.is_active && "text-muted-foreground")}>
      <td className={cn(CELL_CLASS, "font-medium")}>{department.name}</td>
      <td data-label="Kod" className={cn(CELL_CLASS, LABELLED_CLASS, "col-span-2 break-all")}>
        {department.code}
      </td>
      <td data-label="Aktif kullanıcı" className={cn(CELL_CLASS, LABELLED_CLASS)}>
        {members}
      </td>
      <td className={cn(CELL_CLASS, BADGE_CELL_CLASS)}>
        <ActiveBadge active={department.is_active} />
      </td>
      <td className={cn(CELL_CLASS, "justify-self-end md:text-right")}>
        <button
          type="button"
          aria-label={`${department.name} birimini düzenle`}
          onClick={() => onEdit(department)}
          className={EDIT_BUTTON_CLASS}
        >
          Düzenle
        </button>
      </td>
    </tr>
  );
}

// Birim tablosu (Figma: 06 Admin > /admin/departments); pasif birim soluk ama okunur
export function DepartmentsTable({ departments, counts, onEdit }: DepartmentsTableProps) {
  return (
    <AdminTable label="Birimler" columns={COLUMNS}>
      {departments.map((department) => (
        <DepartmentRow
          key={department.id}
          department={department}
          members={counts ? memberLabel(counts.get(department.id)) : NO_VALUE}
          onEdit={onEdit}
        />
      ))}
    </AdminTable>
  );
}
