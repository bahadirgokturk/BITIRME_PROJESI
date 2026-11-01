import type { ReactNode } from "react";

import { cn } from "cn";

import { PriorityBadge } from "@/components/tasks/TaskBadges";
import { formatDuration, type SlaRuleRow } from "@/lib/adminSlaRules";
import { PRIORITY_LABELS } from "@/lib/tasks";

import { ActiveBadge } from "../AdminParts";
import {
  AdminTable,
  BADGE_CELL_CLASS,
  CELL_CLASS,
  EDIT_BUTTON_CLASS,
  END_CELL_CLASS,
  LABELLED_CLASS,
  ROW_CLASS,
} from "../AdminTable";

const COLUMNS = ["Tür", "Öncelik", "Kabul hedefi", "Çözüm hedefi", "Uyarı eşiği", "Durum"];
// Sure ve esik sutunlari saga yaslanir (Figma: 08 Yeni Stil (A) > Sure Hedefleri)
const END_COLUMNS = ["Kabul hedefi", "Çözüm hedefi", "Uyarı eşiği"];
const DEFAULT_NOTE = "Türe özel kuralı olmayan bildirimler";

interface SlaRulesTableProps {
  rows: SlaRuleRow[];
  onEdit: (row: SlaRuleRow) => void;
  // Kayit sayaci; tablonun alt bilgisi
  footer?: ReactNode;
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
      <td data-label="Kabul hedefi" className={cn(CELL_CLASS, LABELLED_CLASS, END_CELL_CLASS, "col-span-2")}>
        {formatDuration(rule.response_minutes)}
      </td>
      <td data-label="Çözüm hedefi" className={cn(CELL_CLASS, LABELLED_CLASS, END_CELL_CLASS, "col-span-2")}>
        {formatDuration(rule.resolution_minutes)}
      </td>
      <td data-label="Uyarı eşiği" className={cn(CELL_CLASS, LABELLED_CLASS, END_CELL_CLASS)}>
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
export function SlaRulesTable({ rows, onEdit, footer }: SlaRulesTableProps) {
  return (
    <AdminTable label="Süre hedefleri" columns={COLUMNS} endColumns={END_COLUMNS} footer={footer}>
      {rows.map((row) => (
        <SlaRuleRowView key={row.rule.id} row={row} onEdit={onEdit} />
      ))}
    </AdminTable>
  );
}
