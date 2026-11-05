"use client";

import { cn } from "cn";

import type { DeltaTone } from "@/lib/analytics";
import {
  recurringHeadline,
  recurringSubtitle,
  recurringTrend,
  type RecurringProblem,
  type RecurringRead,
} from "@/lib/reports";

import { ChartCard } from "../dashboard/ChartCard";
import { ShowAllButton, useShowAll } from "./ShowAll";

// Artan sorun kirmizi, azalan yesil; yon okla ve kelimeyle de yazilir (UI_GUIDE bolum 8)
const TONE_CLASS: Record<DeltaTone, string> = {
  good: "text-success",
  bad: "text-destructive",
  none: "text-muted-foreground",
};

function RecurringItem({ problem }: { problem: RecurringProblem }) {
  const trend = recurringTrend(problem.trend);
  return (
    <li className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="font-medium">{problem.case_type.name}</span>
        <span className="shrink-0 font-semibold">{problem.count} kez</span>
      </div>
      {/* path kod yoludur ("KMP/B/B-Z/B-Z-WC"); okunur ad name alanindadir */}
      <p className="text-xs">{problem.location.name}</p>
      <p className={cn("text-xs font-medium", TONE_CLASS[trend.tone])}>{trend.text}</p>
      <p className="text-xs text-muted-foreground">{problem.suggestion}</p>
      {/* Onleyici bakim onerisi istege bagli alan: eski backend ya da tek araliklik grupta gelmez */}
      {problem.routine_suggestion && (
        <p className="text-xs font-medium text-primary-text">{problem.routine_suggestion}</p>
      )}
    </li>
  );
}

export function RecurringCard({ recurring }: { recurring: RecurringRead }) {
  const { visible, showAll, hasMore, toggle } = useShowAll(recurring.items);
  const subtitle = recurringSubtitle(recurring);
  const total = recurring.items.length;
  return (
    <ChartCard title={recurringHeadline(total)} subtitle={subtitle} className="h-full">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Aynı yerde tekrar tekrar bildirilen bir sorun görülmedi.</p>
      ) : (
        <ul aria-label={subtitle} className="divide-y">
          {visible.map((problem) => (
            <RecurringItem key={`${problem.location.id}-${problem.case_type.id}`} problem={problem} />
          ))}
        </ul>
      )}
      {hasMore && <ShowAllButton showAll={showAll} totalText={`${total} sorunun`} onClick={toggle} />}
    </ChartCard>
  );
}
