import type { ReactNode } from "react";

import { cn } from "cn";

// Yeni stil tablo basligi: gri satir, 40 px, okunur yazi (Figma: 08 Yeni Stil (A) > tablolar)
const HEAD_CLASS = "h-10 px-4 text-left text-sm font-medium whitespace-nowrap";
// Telefonda her satir bir kart: ad ve durum ustte, diger degerler basliklariyla alt alta (tek DOM, iki yerlesim)
export const ROW_CLASS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 surface p-3.5 " +
  "md:table-row md:rounded-none md:border-0 md:shadow-none md:border-t md:bg-transparent";
export const CELL_CLASS = "md:px-4 md:py-3 md:align-middle";
// Telefonda sutun basligi degerin ustune yazilir (data-label); masaustunde baslik satiri gorunur
export const LABELLED_CLASS =
  "before:block before:text-xs before:text-muted-foreground before:content-[attr(data-label)] md:before:hidden";
// Telefonda durum rozeti kartin sag ust kosesinde, adin karsisinda durur
export const BADGE_CELL_CLASS = "col-start-2 row-start-1 justify-self-end";
// Duzenle sade metin dugmesi; satirin asil bilgisini bastirmasin diye gri (Figma: 08 Yeni Stil (A))
export const EDIT_BUTTON_CLASS =
  "-mr-2 min-h-11 px-2 font-medium text-muted-foreground outline-none hover:text-foreground " +
  "focus-visible:ring-3 focus-visible:ring-ring/50";
// Sayi sutunlari masaustunde saga yaslanir (baslik ve deger birlikte)
export const END_CELL_CLASS = "md:text-right md:tabular-nums";

interface AdminTableProps {
  label: string;
  columns: readonly string[];
  // Saga yaslanan sutunlar (ornek: sure, esik); degerler END_CELL_CLASS ile yazilir
  endColumns?: readonly string[];
  // Yalniz okunan tabloda (ornek: islem kayitlari) islem sutunu yoktur
  actions?: boolean;
  // Kayit sayaci; masaustunde kartin alt bilgisi, telefonda kartlarin altinda
  footer?: ReactNode;
  children: ReactNode;
}

function TableHead({ columns, endColumns = [], actions }: Pick<AdminTableProps, "columns" | "endColumns" | "actions">) {
  return (
    <thead className="hidden bg-muted md:table-header-group">
      <tr>
        {columns.map((column) => (
          <th key={column} scope="col" className={cn(HEAD_CLASS, endColumns.includes(column) && "text-right")}>
            {column}
          </th>
        ))}
        {actions ? (
          <th scope="col" className={cn(HEAD_CLASS, "text-right")}>
            İşlem
          </th>
        ) : null}
      </tr>
    </thead>
  );
}

// Yonetim tablosu (Figma: 08 Yeni Stil (A)): masaustunde cerceveli kart, gri baslik, altta sayac;
// telefonda her satir bir kart
export function AdminTable({ label, columns, endColumns, actions = true, footer, children }: AdminTableProps) {
  return (
    <div data-slot="admin-table" className="space-y-3 md:space-y-0 md:surface md:overflow-hidden">
      <div className="md:overflow-x-auto">
        <table aria-label={label} className="block w-full text-sm md:table">
          <TableHead columns={columns} endColumns={endColumns} actions={actions} />
          <tbody className="grid gap-3 md:table-row-group">{children}</tbody>
        </table>
      </div>
      {footer ? <div className="text-sm text-muted-foreground md:border-t md:px-4 md:py-3">{footer}</div> : null}
    </div>
  );
}
