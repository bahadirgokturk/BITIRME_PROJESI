import { cn } from "cn";

import { AUTONOMY_LABELS, formatConfidence, type AgentPolicyRow } from "@/lib/adminAgentPolicies";

import { AdminTable, CELL_CLASS, EDIT_BUTTON_CLASS, LABELLED_CLASS, ROW_CLASS } from "../AdminTable";

// Mudure haber sutunu yok: haberi karar yetkisi belirler (#93)
const COLUMNS = ["Tür", "Karar yetkisi", "Güven eşiği"];

interface AgentPoliciesTableProps {
  rows: AgentPolicyRow[];
  onEdit: (row: AgentPolicyRow) => void;
}

function PolicyRow({ row, onEdit }: { row: AgentPolicyRow; onEdit: (row: AgentPolicyRow) => void }) {
  const { policy } = row;
  return (
    <tr className={ROW_CLASS}>
      <td className={cn(CELL_CLASS, "col-span-2")}>
        <span className="block font-medium">{row.name}</span>
        {row.code ? <span className="block text-xs break-all text-muted-foreground">{row.code}</span> : null}
      </td>
      <td data-label="Karar yetkisi" className={cn(CELL_CLASS, LABELLED_CLASS, "col-span-2")}>
        {AUTONOMY_LABELS[policy.autonomy_level]}
      </td>
      <td data-label="Güven eşiği" className={cn(CELL_CLASS, LABELLED_CLASS)}>
        {formatConfidence(policy.min_confidence_auto)}
      </td>
      <td className={cn(CELL_CLASS, "justify-self-end md:text-right")}>
        <button
          type="button"
          aria-label={`${row.name} politikasını düzenle`}
          onClick={() => onEdit(row)}
          className={EDIT_BUTTON_CLASS}
        >
          Düzenle
        </button>
      </td>
    </tr>
  );
}

// Yapay zeka politikalari tablosu (Figma: 06 Admin > /admin/agent-policies); tur basina bir satir
export function AgentPoliciesTable({ rows, onEdit }: AgentPoliciesTableProps) {
  return (
    <AdminTable label="Yapay zekâ politikaları" columns={COLUMNS}>
      {rows.map((row) => (
        <PolicyRow key={row.policy.id} row={row} onEdit={onEdit} />
      ))}
    </AdminTable>
  );
}
