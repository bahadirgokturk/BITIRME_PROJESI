import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import type { DepartmentStat } from "@/lib/departments";

// break-inside-avoid: yazdirirken kart iki sayfaya bolunmez
export const CARD_CLASS = "surface p-5 break-inside-avoid md:p-6";

// Dort sayi: telefonda ikiserli, genis ekranda tek satir (bildirim, zamaninda, tipik cozum, acik gorev)
export function StatGrid({ stats }: { stats: readonly DepartmentStat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-[1fr_1fr_1.5fr_1fr]">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-xs text-muted-foreground md:text-sm">{stat.label}</dt>
          <dd className="text-xl font-semibold whitespace-nowrap tabular-nums xl:text-2xl">{stat.value}</dd>
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

const LINK_CLASS =
  "surface flex h-full flex-col break-inside-avoid transition-colors outline-none hover:bg-muted/40 " +
  "focus-visible:ring-3 focus-visible:ring-ring/50";

// Birim karti: kartin tamami detaya giden baglanti; personel bilgisi cizgili alt bilgide
// (Figma: 08 Yeni Stil (A) > Birim Performansi)
export function DepartmentCard({ name, stats, staff, href }: DepartmentCardProps) {
  return (
    <Link href={href} className={LINK_CLASS}>
      <span className="flex flex-1 flex-col gap-4 p-5 md:p-6">
        <span className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold md:text-lg">{name}</span>
          <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </span>
        <StatGrid stats={stats} />
      </span>
      <span className="border-t px-5 py-3 text-[13px] text-muted-foreground md:px-6">{staff}</span>
    </Link>
  );
}
