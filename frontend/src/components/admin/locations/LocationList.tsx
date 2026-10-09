import { ChevronRightIcon } from "lucide-react";

import { cn } from "cn";

import { KIND_LABELS, type AdminLocation, type LocationRow } from "@/lib/adminLocations";

import { ActiveBadge } from "../AdminParts";
import { EDIT_BUTTON_CLASS } from "../AdminTable";

// Her duzey bu kadar iceriden baslar; telefonda dar ekrana sigmasi icin kucuk tutulur
const INDENT_PX = 16;

export interface ListRow extends LocationRow {
  // Arama sonucunda konumun nerede oldugu (ust konumlarin adlari); agacta yok
  trail?: string;
}

interface LocationListProps {
  rows: readonly ListRow[];
  onToggle: (id: number) => void;
  onEdit: (location: AdminLocation) => void;
}

function Toggle({ row, onToggle }: { row: ListRow; onToggle: (id: number) => void }) {
  if (!row.hasChildren) {
    return <span aria-hidden className="size-11 shrink-0" />;
  }
  return (
    <button
      type="button"
      aria-expanded={row.expanded}
      aria-label={`${row.location.name} altını ${row.expanded ? "kapat" : "aç"}`}
      onClick={() => onToggle(row.location.id)}
      className="grid size-11 shrink-0 place-items-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ChevronRightIcon aria-hidden className={cn("size-4 transition-transform", row.expanded && "rotate-90")} />
    </button>
  );
}

function LocationItem({ row, onToggle, onEdit }: { row: ListRow } & Omit<LocationListProps, "rows">) {
  const { location } = row;
  return (
    <li
      aria-label={location.name}
      style={{ paddingLeft: row.depth * INDENT_PX }}
      className={cn("flex items-center gap-1 border-t py-1.5 pr-2 first:border-t-0 md:pr-4", !location.is_active && "text-muted-foreground")}
    >
      <Toggle row={row} onToggle={onToggle} />
      <div className="min-w-0 flex-1 py-1">
        <p className="text-sm font-medium">{location.name}</p>
        <p className="text-xs text-muted-foreground">
          {KIND_LABELS[location.kind]} · {location.code} · Önem {location.importance_weight}
        </p>
        {row.trail ? <p className="text-xs text-muted-foreground">{row.trail}</p> : null}
      </div>
      <ActiveBadge active={location.is_active} />
      <button
        type="button"
        aria-label={`${location.name} konumunu düzenle`}
        onClick={() => onEdit(location)}
        className={cn(EDIT_BUTTON_CLASS, "shrink-0 text-sm")}
      >
        Düzenle
      </button>
    </li>
  );
}

// Konum listesi (Figma: 06 Admin > /admin/locations): agacta girintili satirlar, aramada duz sonuc listesi
export function LocationList({ rows, onToggle, onEdit }: LocationListProps) {
  return (
    <ul aria-label="Konumlar" className="rounded-xl border bg-card">
      {rows.map((row) => (
        <LocationItem key={row.location.id} row={row} onToggle={onToggle} onEdit={onEdit} />
      ))}
    </ul>
  );
}
