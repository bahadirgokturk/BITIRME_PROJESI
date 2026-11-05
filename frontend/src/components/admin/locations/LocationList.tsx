import { ChevronRightIcon, MapPinIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "cn";

import { KIND_LABELS, type AdminLocation, type LocationRow } from "@/lib/adminLocations";

import { ActiveBadge, Tag } from "../AdminParts";
import {
  AdminTable,
  BADGE_CELL_CLASS,
  CELL_CLASS,
  EDIT_BUTTON_CLASS,
  END_CELL_CLASS,
  LABELLED_CLASS,
  ROW_CLASS,
} from "../AdminTable";

// Her duzey bu kadar iceriden baslar; telefonda dar ekrana sigmasi icin kucuk tutulur
const INDENT_PX = 16;
const COLUMNS = ["Konum", "Tür", "Kod", "Önem", "Durum"];
const END_COLUMNS = ["Önem"];

export interface ListRow extends LocationRow {
  // Arama sonucunda konumun nerede oldugu (ust konumlarin adlari); agacta yok
  trail?: string;
}

interface LocationListProps {
  rows: readonly ListRow[];
  onToggle: (id: number) => void;
  onEdit: (location: AdminLocation) => void;
  // Kayit sayaci; tablonun alt bilgisi
  footer?: ReactNode;
}

// Telefonda bu degerler adin altindaki satirda yazilir
const PHONE_HIDDEN = "max-md:hidden";
// Telefonda kart tek satir: ad, durum, Duzenle yan yana
const PHONE_ROW = "max-md:grid-cols-[minmax(0,1fr)_auto_auto]";
const TOGGLE_SIZE = "size-11 shrink-0 md:size-8";

function Toggle({ row, onToggle }: { row: ListRow; onToggle: (id: number) => void }) {
  if (!row.hasChildren) {
    return <span aria-hidden className={TOGGLE_SIZE} />;
  }
  return (
    <button
      type="button"
      aria-expanded={row.expanded}
      aria-label={`${row.location.name} altını ${row.expanded ? "kapat" : "aç"}`}
      onClick={() => onToggle(row.location.id)}
      className={cn(
        TOGGLE_SIZE,
        "grid place-items-center rounded-md outline-none hover:bg-muted",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      <ChevronRightIcon aria-hidden className={cn("size-4 transition-transform", row.expanded && "rotate-90")} />
    </button>
  );
}

// Ad hucresi: girinti + ac/kapa oku + konum simgesi; aramada altinda konumun yeri
function NameCell({ row, onToggle }: { row: ListRow; onToggle: (id: number) => void }) {
  return (
    <td className={CELL_CLASS}>
      <div className="flex items-center gap-1" style={{ paddingLeft: row.depth * INDENT_PX }}>
        <Toggle row={row} onToggle={onToggle} />
        <MapPinIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <div className="ml-1 min-w-0">
          <p className="font-medium">{row.location.name}</p>
          {/* Telefonda tur, kod ve onem tek satirda; agac kisa kartlarla okunur */}
          <p className="text-xs text-muted-foreground md:hidden">
            {KIND_LABELS[row.location.kind]} · {row.location.code} · Önem {row.location.importance_weight}
          </p>
          {row.trail ? <p className="text-xs text-muted-foreground">{row.trail}</p> : null}
        </div>
      </div>
    </td>
  );
}

function LocationItem({ row, onToggle, onEdit }: { row: ListRow } & Omit<LocationListProps, "rows" | "footer">) {
  const { location } = row;
  return (
    <tr aria-label={location.name} className={cn(ROW_CLASS, PHONE_ROW, !location.is_active && "text-muted-foreground")}>
      <NameCell row={row} onToggle={onToggle} />
      <td data-label="Tür" className={cn(CELL_CLASS, LABELLED_CLASS, PHONE_HIDDEN)}>
        {KIND_LABELS[location.kind]}
      </td>
      <td data-label="Kod" className={cn(CELL_CLASS, LABELLED_CLASS, PHONE_HIDDEN)}>
        <Tag tone="muted">{location.code}</Tag>
      </td>
      <td data-label="Önem" className={cn(CELL_CLASS, LABELLED_CLASS, END_CELL_CLASS, PHONE_HIDDEN)}>
        {location.importance_weight}
      </td>
      <td className={cn(CELL_CLASS, BADGE_CELL_CLASS)}>
        <ActiveBadge active={location.is_active} />
      </td>
      <td className={cn(CELL_CLASS, "col-start-3 row-start-1 justify-self-end md:text-right")}>
        <button
          type="button"
          aria-label={`${location.name} konumunu düzenle`}
          onClick={() => onEdit(location)}
          className={EDIT_BUTTON_CLASS}
        >
          Düzenle
        </button>
      </td>
    </tr>
  );
}

// Konum tablosu (Figma: 08 Yeni Stil (A) > Konumlar): agacta girintili satirlar, aramada duz sonuc listesi
export function LocationList({ rows, onToggle, onEdit, footer }: LocationListProps) {
  return (
    <AdminTable label="Konumlar" columns={COLUMNS} endColumns={END_COLUMNS} footer={footer}>
      {rows.map((row) => (
        <LocationItem key={row.location.id} row={row} onToggle={onToggle} onEdit={onEdit} />
      ))}
    </AdminTable>
  );
}
