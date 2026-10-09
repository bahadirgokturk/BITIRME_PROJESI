import type { ReactNode } from "react";

const HEAD_CLASS = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";
// Telefonda her satir bir kart: ad ve durum ustte, diger degerler basliklariyla alt alta (tek DOM, iki yerlesim)
export const ROW_CLASS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border bg-card p-3.5 " +
  "md:table-row md:rounded-none md:border-0 md:border-t md:bg-transparent";
export const CELL_CLASS = "md:px-4 md:py-3 md:align-middle";
// Telefonda sutun basligi degerin ustune yazilir (data-label); masaustunde baslik satiri gorunur
export const LABELLED_CLASS =
  "before:block before:text-xs before:text-muted-foreground before:content-[attr(data-label)] md:before:hidden";
// Telefonda durum rozeti kartin sag ust kosesinde, adin karsisinda durur
export const BADGE_CELL_CLASS = "col-start-2 row-start-1 justify-self-end";
export const EDIT_BUTTON_CLASS =
  "min-h-11 px-2 font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

interface AdminTableProps {
  label: string;
  // Son sutun (Duzenle) basliksizdir; ekran okuyucu icin gizli bir baslik eklenir
  columns: readonly string[];
  children: ReactNode;
}

// Yonetim tablosu (Figma: 06 Admin): masaustunde klasik tablo, telefonda her satir bir kart
export function AdminTable({ label, columns, children }: AdminTableProps) {
  return (
    <div className="md:overflow-x-auto md:rounded-xl md:border">
      <table aria-label={label} className="block w-full text-sm md:table">
        <thead className="hidden bg-muted md:table-header-group">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className={HEAD_CLASS}>
                {column}
              </th>
            ))}
            <th className={HEAD_CLASS}>
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody className="grid gap-3 md:table-row-group">{children}</tbody>
      </table>
    </div>
  );
}
