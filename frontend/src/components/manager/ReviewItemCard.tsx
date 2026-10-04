"use client";

import { useId, useState } from "react";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import type { ReviewItem } from "@/hooks/useReview";
import { relativeTime } from "@/lib/dates";
import { priorityLabel, reviewBadge, type BadgeTone } from "@/lib/review";

import { Confidence } from "./Confidence";
import { DecisionPanel } from "./DecisionPanel";
import { ReviewActions } from "./ReviewActions";

const TONE_CLASS: Record<BadgeTone, string> = {
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-foreground",
};

function Suggestion({ item }: { item: ReviewItem }) {
  const rows: [string, string][] = [
    ["Yapay zekâ önerisi · Tür", item.case.case_type?.name ?? "Belirlenmedi"],
    ["Öncelik", item.case.priority ? priorityLabel(item.case.priority) : "Belirlenmedi"],
    ["Birim", item.case.department?.name ?? "Belirlenmedi"],
  ];
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ItemHeader({ item, titleId }: { item: ReviewItem; titleId: string }) {
  const badge = reviewBadge(item);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          {item.case.case_number} · {relativeTime(item.case.created_at)}
        </p>
        <h2 id={titleId} className="font-semibold">
          {item.case.title}
        </h2>
        <p className="text-sm text-muted-foreground">{item.case.location.name}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", TONE_CLASS[badge.tone])}>{badge.label}</span>
        <Confidence value={item.confidence} />
      </div>
    </div>
  );
}

// Kuyruk satiri: neden burada, AI onerisi, islemler ve istege bagli gerekce paneli (Figma: 05 Manager)
export function ReviewItemCard({ item, onDone }: { item: ReviewItem; onDone: (message: string) => void }) {
  const titleId = useId();
  const [showReasons, setShowReasons] = useState(false);
  return (
    <article aria-labelledby={titleId} className="space-y-4 rounded-xl border bg-card p-5">
      <ItemHeader item={item} titleId={titleId} />
      {item.reason ? (
        <div>
          <p className="text-xs text-muted-foreground">Neden burada?</p>
          <p className="text-sm">{item.reason}</p>
        </div>
      ) : null}
      {item.possible_duplicate_of ? (
        <p className="rounded-md bg-muted px-3 py-2 text-[13px]">
          Benzer bildirim: {item.possible_duplicate_of.case_number} · {item.possible_duplicate_of.title}
        </p>
      ) : null}
      <Suggestion item={item} />
      <div className="flex flex-wrap items-center gap-2">
        <ReviewActions item={item} onDone={onDone} />
        <Button
          variant="ghost"
          className="ml-auto h-11 px-3 text-primary"
          aria-expanded={showReasons}
          onClick={() => setShowReasons(!showReasons)}
        >
          {showReasons ? "Gerekçeyi gizle" : "Yapay zekâ gerekçesi"}
        </Button>
      </div>
      {showReasons ? <DecisionPanel caseId={item.case.id} /> : null}
    </article>
  );
}
