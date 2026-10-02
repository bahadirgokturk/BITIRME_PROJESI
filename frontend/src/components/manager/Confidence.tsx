import { confidencePercent } from "@/lib/review";

const PERCENT = 100;

// Guven: yuzde metni + cubuk (durum yalniz renkle anlatilmaz, UI_GUIDE bolum 8)
export function Confidence({ value }: { value: number | null }) {
  const label = confidencePercent(value);
  if (value === null || label === null) {
    return null;
  }
  return (
    <div className="flex w-24 flex-col items-end gap-1">
      <span className="text-xs font-medium">Güven {label}</span>
      <span aria-hidden className="block h-1 w-full rounded-full bg-border">
        <span className="block h-1 rounded-full bg-primary" style={{ width: `${Math.round(value * PERCENT)}%` }} />
      </span>
    </div>
  );
}
