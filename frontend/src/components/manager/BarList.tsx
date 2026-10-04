import { cn } from "cn";

export type BarTone = "primary" | "danger" | "warning";

export interface BarItem {
  key: string | number;
  label: string;
  value: string;
  // Cubugun doluluk orani (0-100)
  percent: number;
  hint?: string | null;
  tone?: BarTone;
  // Satiri one cikaran kisa etiket (ornek: en yavas adim)
  badge?: string;
}

// Renk tek basina anlam tasimaz: vurgulanan satir etiketle ya da notla da anlatilir (UI_GUIDE bolum 8)
const TONE_CLASS: Record<BarTone, string> = {
  primary: "bg-primary",
  danger: "bg-destructive",
  warning: "bg-warning",
};

// Yatay cubuk listesi: grafik kutuphanesi yok, cubuklar duz HTML/CSS (UI_GUIDE bolum 5.4)
export function BarList({ label, items }: { label: string; items: readonly BarItem[] }) {
  return (
    <ul aria-label={label} className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <span>{item.label}</span>
              {item.badge && (
                <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">{item.badge}</span>
              )}
            </span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div aria-hidden className="h-2 rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", TONE_CLASS[item.tone ?? "primary"])}
              style={{ width: `${item.percent}%` }}
            />
          </div>
          {item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
        </li>
      ))}
    </ul>
  );
}
