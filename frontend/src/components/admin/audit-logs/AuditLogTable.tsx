"use client";

import { useState } from "react";

import { cn } from "cn";

import {
  actionLabel,
  auditChanges,
  isCreation,
  recordName,
  type AuditChange,
  type AuditLog,
  type NameLookup,
} from "@/lib/auditLogs";
import { formatDateTime } from "@/lib/dates";

import { AdminTable, CELL_CLASS, LABELLED_CLASS, ROW_CLASS } from "../AdminTable";

const COLUMNS = ["Zaman", "Kim", "İşlem", "Değişiklik"];
// Telefonda her deger kartta tam satir kaplar; masaustunde ust hizali durur (degisiklik birkac satir olabilir)
const CELL = cn(CELL_CLASS, LABELLED_CLASS, "col-span-2 md:align-top");
const TOGGLE_CLASS =
  "min-h-11 font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-0";

interface AuditLogTableProps {
  logs: AuditLog[];
  lookup: NameLookup;
}

// "Ad: Destek -> Destek Hizmetleri"; yeni kayitta yalniz yeni deger
function ChangeList({ changes, hidden }: { changes: AuditChange[]; hidden?: boolean }) {
  return (
    <ul hidden={hidden} className="space-y-0.5">
      {changes.map((change) => (
        <li key={change.label}>
          <span className="text-muted-foreground">{change.label}: </span>
          <span>{change.before === null ? change.after : `${change.before} → ${change.after}`}</span>
        </li>
      ))}
    </ul>
  );
}

// Yeni kayit butun alanlariyla gelir; liste uzamasin diye alanlar istenince acilir
function NewRecord({ changes }: { changes: AuditChange[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <p>
        <span>Yeni kayıt</span>
        {" · "}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={TOGGLE_CLASS}>
          {open ? "Alanları gizle" : "Alanları göster"}
        </button>
      </p>
      <ChangeList changes={changes} hidden={!open} />
    </div>
  );
}

function AuditLogRow({ log, lookup }: { log: AuditLog; lookup: NameLookup }) {
  const changes = auditChanges(log, lookup);
  return (
    <tr className={ROW_CLASS}>
      <td data-label="Zaman" className={cn(CELL, "md:whitespace-nowrap")}>
        <time dateTime={log.created_at}>{formatDateTime(log.created_at)}</time>
      </td>
      <td data-label="Kim" className={CELL}>
        {log.actor_name}
      </td>
      {/* Telefonda islem kartin basligidir: en uste alinir */}
      <td className={cn(CELL_CLASS, "col-span-2 max-md:order-first md:align-top")}>
        <span className="block font-medium">{actionLabel(log)}</span>
        <span className="block text-xs text-muted-foreground">{recordName(log, lookup)}</span>
      </td>
      <td data-label="Değişiklik" className={CELL}>
        {isCreation(log) ? <NewRecord changes={changes} /> : <ChangeList changes={changes} />}
      </td>
    </tr>
  );
}

// Islem kayitlari tablosu (Figma: 06 Admin > /admin/audit-logs); yalniz okunur, islem sutunu yok
export function AuditLogTable({ logs, lookup }: AuditLogTableProps) {
  return (
    <AdminTable label="İşlem kayıtları" columns={COLUMNS} actions={false}>
      {logs.map((log) => (
        <AuditLogRow key={log.id} log={log} lookup={lookup} />
      ))}
    </AdminTable>
  );
}
