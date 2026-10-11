import { cn } from "cn";

import { PriorityBadge } from "@/components/tasks/TaskBadges";
import { formatDuration, type SlaRuleRow } from "@/lib/adminSlaRules";
import { PRIORITY_LABELS } from "@/lib/tasks";

import { ActiveBadge } from "../AdminParts";
import { AdminTable, BADGE_CELL_CLASS, CELL_CLASS, EDIT_BUTTON_CLASS, LABELLED_CLASS, ROW_CLASS } from "../AdminTable";

const COLUMNS = ["Tür", "Öncelik", "Kabul hedefi", "Çözüm hedefi", "Uyarı eşiği", "Durum"];
const DEFAULT_NOTE = "Türe özel kuralı olmayan bildirimler";

interface SlaRulesTableProps {
  rows: SlaRuleRow[];
  onEdit: (row: SlaRuleRow) => void;
}

// Ad, altinda tur kodu; varsayilan kuralda kod yerine kisa aciklama
function TypeCell({ row }: { row: SlaRuleRow }) {
  return (
    <td className={CELL_CLASS}>
      <span className="block font-medium">{row.typeName}</span>
      <span className="block text-xs break-all text-muted-foreground">{row.typeCode ?? DEFAULT_NOTE}</span>
    </td>
  );
}

function SlaRuleRowView({ row, onEdit }: { row: SlaRuleRow; onEdit: (row: SlaRuleRow) => void }) {
  const { rule } = row;
  return (
    <tr className={cn(ROW_CLASS, !rule.is_active && "text-muted-foreground")}>
      <TypeCell row={row} />
      <td data-label="Öncelik" className={cn(CELL_CLASS, LABELLED_CLASS, "col-span-2")}>
        <PriorityBadge priority={rule.priority} />
      </td>
      <td data-label="Kabul hedefi" className={cn(CELL_CLASS, LABELLED_CLASS, "col-span-2")}>
        {formatDuration(rule.response_minutes)}
      </td>
      <td data-label="Çözüm hedefi" className={cn(CELL_CLASS, LABELLED_CLASS, "col-span-2")}>
        {formatDuration(rule.resolution_minutes)}
      </td>
      <td data-label="Uyarı eşiği" className={cn(CELL_CLASS, LABELLED_CLASS)}>
        %{rule.warning_threshold_pct}
      </td>
      <td className={cn(CELL_CLASS, BADGE_CELL_CLASS)}>
        <ActiveBadge active={rule.is_active} />
      </td>
      <td className={cn(CELL_CLASS, "justify-self-end md:text-right")}>
        <button
          type="button"
          aria-label={`${row.typeName} ${PRIORITY_LABELS[rule.priority]} kuralını düzenle`}
          onClick={() => onEdit(row)}
          className={EDIT_BUTTON_CLASS}
        >
          Düzenle
        </button>
      </td>
    </tr>
  );
}

// Sure hedefleri tablosu (Figma: 06 Admin > /admin/sla-rules); pasif kural soluk ama okunur
export function SlaRulesTable({ rows, onEdit }: SlaRulesTableProps) {
  return (
    <AdminTable label="Süre hedefleri" columns={COLUMNS}>
      {rows.map((row) => (
        <SlaRuleRowView key={row.rule.id} row={row} onEdit={onEdit} />
      ))}
    </AdminTable>
  );
}
