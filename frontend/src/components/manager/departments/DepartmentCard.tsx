import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import type { DepartmentStat } from "@/lib/departments";

// break-inside-avoid: yazdirirken kart iki sayfaya bolunmez
export const CARD_CLASS = "surface p-4 break-inside-avoid md:p-5";

// Dort sayi ikiserli: bildirim, zamaninda, tipik cozum, acik gorev
export function StatGrid({ stats }: { stats: readonly DepartmentStat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="text-xl font-semibold">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface DepartmentCardProps {
  name: string;
  stats: readonly DepartmentStat[];
  staff: string;
  href: string;
}

// Birim karti: kartin tamami detaya giden baglanti (Figma: 02 Components > DepartmentCard)
export function DepartmentCard({ name, stats, staff, href }: DepartmentCardProps) {
  return (
    <Link
      href={href}
      className={`${CARD_CLASS} flex h-full flex-col gap-4 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">{name}</span>
        <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </span>
      <StatGrid stats={stats} />
      <span className="mt-auto text-xs text-muted-foreground">{staff}</span>
    </Link>
  );
}
