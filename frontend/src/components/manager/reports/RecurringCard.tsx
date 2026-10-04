"use client";

import { useState } from "react";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import type { DeltaTone } from "@/lib/analytics";
import {
  recurringHeadline,
  recurringSubtitle,
  recurringTrend,
  type RecurringProblem,
  type RecurringRead,
} from "@/lib/reports";

import { ChartCard } from "../dashboard/ChartCard";

// Gercek veride onlarca tekrarlayan sorun cikabilir; kart uzamasin diye once en cok tekrar edenler gosterilir
const VISIBLE_COUNT = 5;

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
    </li>
  );
}

export function RecurringCard({ recurring }: { recurring: RecurringRead }) {
  const [showAll, setShowAll] = useState(false);
  const subtitle = recurringSubtitle(recurring);
  const total = recurring.items.length;
  const visible = showAll ? recurring.items : recurring.items.slice(0, VISIBLE_COUNT);
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
      {total > VISIBLE_COUNT && (
        <Button variant="outline" className="h-11 w-full md:h-9 md:w-auto" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Daha az göster" : `${total} sorunun hepsini göster`}
        </Button>
      )}
    </ChartCard>
  );
}
