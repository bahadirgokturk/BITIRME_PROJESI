import { cn } from "cn";

import { PriorityBadge } from "@/components/tasks/TaskBadges";
import { departmentLabel, type CaseType } from "@/lib/adminCaseTypes";
import { CATEGORY_LABELS } from "@/lib/reports";

import { ActiveBadge } from "../AdminParts";
import { AdminTable, BADGE_CELL_CLASS, CELL_CLASS, EDIT_BUTTON_CLASS, LABELLED_CLASS, ROW_CLASS } from "../AdminTable";

const COLUMNS = ["Tür", "Kategori", "Görevi alan birim", "Öncelik", "Durum"];

type Departments = readonly { id: number; name: string }[] | undefined;

interface CaseTypesTableProps {
  caseTypes: CaseType[];
  // Birim adlari; liste henuz gelmediyse undefined
  departments: Departments;
  onEdit: (caseType: CaseType) => void;
}

interface RowProps {
  caseType: CaseType;
  department: string;
  onEdit: (caseType: CaseType) => void;
}

// Ad, altinda kod; guvenlikle ilgili turlerde kodun yaninda not (Figma: tablonun ilk sutunu)
function NameCell({ caseType }: { caseType: CaseType }) {
  return (
    <td className={CELL_CLASS}>
      <span className="block font-medium">{caseType.name}</span>
      <span className="block text-xs break-all text-muted-foreground">
        <span>{caseType.code}</span>
        {caseType.is_safety_related ? (
          <>
            {" · "}
            <span>Güvenlikle ilgili</span>
          </>
        ) : null}
      </span>
    </td>
  );
}

function CaseTypeRow({ caseType, department, onEdit }: RowProps) {
  return (
    <tr className={cn(ROW_CLASS, !caseType.is_active && "text-muted-foreground")}>
      <NameCell caseType={caseType} />
      <td data-label="Kategori" className={cn(CELL_CLASS, LABELLED_CLASS, "col-span-2")}>
        {CATEGORY_LABELS[caseType.category]}
      </td>
      <td data-label="Görevi alan birim" className={cn(CELL_CLASS, LABELLED_CLASS, "col-span-2")}>
        {department}
      </td>
      <td data-label="Öncelik" className={cn(CELL_CLASS, LABELLED_CLASS)}>
        <PriorityBadge priority={caseType.base_priority} />
      </td>
      <td className={cn(CELL_CLASS, BADGE_CELL_CLASS)}>
        <ActiveBadge active={caseType.is_active} />
      </td>
      <td className={cn(CELL_CLASS, "justify-self-end md:text-right")}>
        <button
          type="button"
          aria-label={`${caseType.name} türünü düzenle`}
          onClick={() => onEdit(caseType)}
          className={EDIT_BUTTON_CLASS}
        >
          Düzenle
        </button>
      </td>
    </tr>
  );
}

// Bildirim turleri tablosu (Figma: 06 Admin > /admin/case-types); pasif tur soluk ama okunur
export function CaseTypesTable({ caseTypes, departments, onEdit }: CaseTypesTableProps) {
  return (
    <AdminTable label="Bildirim türleri" columns={COLUMNS}>
      {caseTypes.map((caseType) => (
        <CaseTypeRow
          key={caseType.id}
          caseType={caseType}
          department={departmentLabel(caseType.default_department_id, departments)}
          onEdit={onEdit}
        />
      ))}
    </AdminTable>
  );
}
