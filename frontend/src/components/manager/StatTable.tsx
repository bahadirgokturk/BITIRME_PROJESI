export interface StatRow {
  key: string | number;
  name: string;
  // Sutun basliklariyla ayni sirada, bicimlenmis degerler
  cells: readonly string[];
}

interface StatTableProps {
  label: string;
  nameHeader: string;
  columns: readonly string[];
  rows: readonly StatRow[];
}

// Telefonda sutun basligi her degerin ustune yazilir (data-label); masaustunde baslik satiri gorunur
const CELL_CLASS =
  "text-sm before:block before:text-xs before:font-normal before:text-muted-foreground before:content-[attr(data-label)] " +
  "md:px-3 md:py-2.5 md:text-right md:tabular-nums md:before:hidden";
// Masaustunde cerceveli tablo, gri baslik satiri (Figma: 08 Yeni Stil (A) > Raporlar)
const HEAD_CLASS = "h-10 px-3 text-sm font-medium whitespace-nowrap";

// Sayi tablosu: masaustunde klasik tablo, telefonda her satir kucuk bir kart (ikili izgara).
// Tek bir <table> kullanilir ki ekran okuyucu iki gorunumde de ayni yapiyi okusun.
export function StatTable({ label, nameHeader, columns, rows }: StatTableProps) {
  return (
    <div className="md:overflow-x-auto md:rounded-lg md:border">
      <table aria-label={label} className="block w-full md:table">
        <thead className="hidden bg-muted md:table-header-group">
          <tr>
            <th scope="col" className={`${HEAD_CLASS} text-left`}>
              {nameHeader}
            </th>
            {columns.map((column) => (
              <th key={column} scope="col" className={`${HEAD_CLASS} text-right`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block divide-y md:table-row-group">
          {rows.map((row) => (
            <tr key={row.key} className="grid grid-cols-2 gap-x-3 gap-y-2 py-3 first:pt-0 md:table-row md:border-t">
              <th scope="row" className="col-span-2 text-left text-sm font-medium md:px-3 md:py-2.5 md:font-normal">
                {row.name}
              </th>
              {row.cells.map((cell, index) => (
                <td key={columns[index]} data-label={columns[index]} className={CELL_CLASS}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
