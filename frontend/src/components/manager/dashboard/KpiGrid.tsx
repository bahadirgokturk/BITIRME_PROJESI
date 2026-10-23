import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { kpiCards, type DeltaTone, type KpiCardView, type KpisRead } from "@/lib/analytics";
import type { Role } from "@/lib/navigation";

const CARD_CLASS = "rounded-lg border bg-card p-3.5 break-inside-avoid md:p-5";
const GRID_CLASS = "grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3";
const SKELETON_KEYS = ["k1", "k2", "k3", "k4", "k5", "k6"];

// Iyi degisim yesil, kotu degisim kirmizi; yon okla ve metinle de anlatilir (UI_GUIDE bolum 8)
const TONE_CLASS: Record<DeltaTone, string> = {
  good: "text-success",
  bad: "text-destructive",
  none: "text-muted-foreground",
};

// Tiklanabilir kart: tamami baglanti, sag ustte ok (Figma: KpiCard, Genel Bakis)
const LINK_CLASS =
  "block h-full rounded-[inherit] p-3.5 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 md:p-5";

function KpiCardBody({ card, days }: { card: KpiCardView; days: number }) {
  return (
    <>
      <p className="flex items-center justify-between gap-2 text-sm font-medium">
        {card.label}
        {card.href ? <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
      </p>
      <p className="mt-1 text-2xl font-semibold md:text-3xl">{card.value}</p>
      <p className="mt-1 flex flex-col text-xs text-muted-foreground md:flex-row md:items-center md:gap-1.5">
        {/* Karsilastirma yoksa tek basina duran tire gosterilmez */}
        {card.hasPrevious ? (
          <span className={cn("text-sm font-medium", TONE_CLASS[card.delta.tone])}>{card.delta.text}</span>
        ) : null}
        {card.hasPrevious ? `önceki ${days} güne göre` : "önceki dönemde veri yok"}
      </p>
    </>
  );
}

// Liste ogesine rol verilmez (axe: aria-allowed-role); adli grup ogenin icindeki kutudur
function KpiCard({ card, days }: { card: KpiCardView; days: number }) {
  if (!card.href) {
    return (
      <li>
        <div role="group" aria-label={card.label} className={cn(CARD_CLASS, "h-full")}>
          <KpiCardBody card={card} days={days} />
        </div>
      </li>
    );
  }
  return (
    <li>
      <div role="group" aria-label={card.label} className="h-full rounded-lg border bg-card break-inside-avoid">
        <Link href={card.href} className={LINK_CLASS}>
          <KpiCardBody card={card} days={days} />
        </Link>
      </div>
    </li>
  );
}

interface KpiGridProps {
  kpis: KpisRead;
  days: number;
  // Rol verilirse kartlar o rolun gidebildigi ekranlara baglanir (lib/analytics.ts KPI_LINKS)
  role?: Role;
}

export function KpiGrid({ kpis, days, role }: KpiGridProps) {
  return (
    <ul aria-label="Temel göstergeler" className={GRID_CLASS}>
      {kpiCards(kpis, role).map((card) => (
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
