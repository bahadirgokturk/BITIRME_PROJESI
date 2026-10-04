import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { kpiCards, type DeltaTone, type KpiCardView, type KpisRead } from "@/lib/analytics";

const CARD_CLASS = "rounded-lg border bg-card p-3.5 md:p-5";
const GRID_CLASS = "grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3";
const SKELETON_KEYS = ["k1", "k2", "k3", "k4", "k5", "k6"];

// Iyi degisim yesil, kotu degisim kirmizi; yon okla ve metinle de anlatilir (UI_GUIDE bolum 8)
const TONE_CLASS: Record<DeltaTone, string> = {
  good: "text-success",
  bad: "text-destructive",
  none: "text-muted-foreground",
};

function KpiCard({ card, days }: { card: KpiCardView; days: number }) {
  return (
    <li role="group" aria-label={card.label} className={CARD_CLASS}>
      <p className="text-sm font-medium">{card.label}</p>
      <p className="mt-1 text-2xl font-semibold md:text-3xl">{card.value}</p>
      <p className="mt-1 flex flex-col text-xs text-muted-foreground md:flex-row md:items-center md:gap-1.5">
        <span className={cn("text-sm font-medium", TONE_CLASS[card.delta.tone])}>{card.delta.text}</span>
        {card.hasPrevious ? `önceki ${days} güne göre` : "önceki dönemde veri yok"}
      </p>
    </li>
  );
}

export function KpiGrid({ kpis, days }: { kpis: KpisRead; days: number }) {
  return (
    <ul aria-label="Temel göstergeler" className={GRID_CLASS}>
      {kpiCards(kpis).map((card) => (
        <KpiCard key={card.label} card={card} days={days} />
      ))}
    </ul>
  );
}

export function KpiGridSkeleton() {
  return (
    <div className={GRID_CLASS}>
      {SKELETON_KEYS.map((key) => (
        <div key={key} className={cn(CARD_CLASS, "space-y-2.5")}>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
