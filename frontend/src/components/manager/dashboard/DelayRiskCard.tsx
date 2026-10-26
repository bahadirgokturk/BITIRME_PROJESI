"use client";

import Link from "next/link";

import { cn } from "cn";

import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayRisk } from "@/hooks/useAnalytics";
import { formatDateTime } from "@/lib/dates";
import {
  alreadyLateText,
  delayRiskEmptyText,
  delayRiskHeadline,
  elapsedText,
  factorsText,
  LATE_CASES_PATH,
  modelNote,
  riskBadge,
  type DelayRiskItem,
  type DelayRiskLevel,
  type DelayRiskRead,
} from "@/lib/delayRisk";

import { ShowAllButton, useShowAll } from "../reports/ShowAll";
import { PANEL_CLASS } from "./ChartCard";

const CARD_NAME = "Gecikme riski";
// Yuksek risk kirmizi, orta turuncu, dusuk gri; renk yaninda metin de soyler (UI_GUIDE bolum 8)
const TONE_CLASS: Record<DelayRiskLevel, string> = {
  HIGH: "bg-destructive/10 text-destructive",
  MEDIUM: "bg-warning/10 text-warning",
  LOW: "bg-muted text-muted-foreground",
};
const LINK_CLASS =
  "font-medium text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";
const LATE_CLASS =
  "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm";
const SUBTITLE = "Açık bildirimlerin hedef süreyi aşma olasılığı · en riskli üstte";

function RiskTime({ item }: { item: DelayRiskItem }) {
  const badge = riskBadge(item);
  return (
    <div className="flex shrink-0 flex-col gap-1.5 text-xs text-muted-foreground md:items-end">
      <span className={cn("w-fit rounded-md px-2 py-0.5 font-medium", TONE_CLASS[badge.tone])}>{badge.label}</span>
      <span>Hedef: {formatDateTime(item.due_at)}</span>
      <span aria-hidden className="h-1.5 w-30 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-muted-foreground" style={{ width: `${item.elapsed_pct}%` }} />
      </span>
      <span>{elapsedText(item.elapsed_pct)}</span>
    </div>
  );
}

function RiskRow({ item }: { item: DelayRiskItem }) {
  const factors = factorsText(item);
  return (
    <li className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">
          {item.case_number}
          {item.department_name ? ` · ${item.department_name}` : null}
        </p>
        <Link href={`/manager/cases/${item.case_id}`} className={cn("block text-sm break-words", LINK_CLASS)}>
          {item.title}
        </Link>
        {factors ? <p className="text-xs text-muted-foreground">{factors}</p> : null}
      </div>
      <RiskTime item={item} />
    </li>
  );
}

function RiskList({ items }: { items: DelayRiskItem[] }) {
  const { visible, showAll, hasMore, toggle } = useShowAll(items);
  return (
    <>
      <ul aria-label="Gecikme riski olan bildirimler" className="divide-y">
        {visible.map((item) => (
          <RiskRow key={item.case_id} item={item} />
        ))}
      </ul>
      {hasMore ? <ShowAllButton showAll={showAll} totalText={`${items.length} bildirimin`} onClick={toggle} /> : null}
    </>
  );
}

function AlreadyLate({ count }: { count: number }) {
  const text = alreadyLateText(count);
  if (!text) {
    return null;
  }
  return (
    <p className={LATE_CLASS}>
      <span className="font-medium text-destructive">{text}</span>
      <Link href={LATE_CASES_PATH} className={LINK_CLASS}>
        Gecikenleri gör
      </Link>
    </p>
  );
}

function RiskBody({ data }: { data: DelayRiskRead }) {
  const empty = delayRiskEmptyText(data);
  return (
    <>
      {data.model ? <AlreadyLate count={data.already_late} /> : null}
      {empty ? <p className="text-sm text-muted-foreground">{empty}</p> : <RiskList items={data.items} />}
      {data.model ? <p className="text-xs text-muted-foreground">{modelNote(data.model)}</p> : null}
    </>
  );
}

function RiskSkeleton() {
  return (
    <div aria-label="Gecikme riski yükleniyor" aria-busy="true" className={PANEL_CLASS}>
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

// Acik bildirimlerin hedef sureyi asma olasiligi; en riskli ustte (Figma: 05 Manager > /manager/dashboard >
// DelayRiskCard). Kendi sorgusu var: hata verirse panonun geri kalani yine gorunur
export function DelayRiskCard() {
  const query = useDelayRisk();
  if (query.isPending) {
    return <RiskSkeleton />;
  }
  if (query.isError) {
    return <ErrorState title="Gecikme riski yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  return (
    <section aria-label={CARD_NAME} className={PANEL_CLASS}>
      <div>
        <h2 className="font-semibold">{delayRiskHeadline(query.data)}</h2>
        <p className="text-xs text-muted-foreground">{SUBTITLE}</p>
      </div>
      <RiskBody data={query.data} />
    </section>
  );
}
