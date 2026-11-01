"use client";

import { MapPinIcon } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "cn";

import { Button } from "@/components/ui/button";
import type { ReviewItem } from "@/hooks/useReview";
import { relativeTime } from "@/lib/dates";
import { priorityLabel, reviewBadge, type BadgeTone } from "@/lib/review";

import { Confidence } from "./Confidence";
import { DecisionPanel } from "./DecisionPanel";
import { ReviewActions } from "./ReviewActions";

// Neden rozeti cerceveli; yoneticiye iletilen kirmizi (Figma: 08 Yeni Stil (A))
const TONE_CLASS: Record<BadgeTone, string> = {
  danger: "border-destructive/30 bg-destructive/5 text-destructive",
  neutral: "",
};
const BADGE_CLASS =
  "inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-xs font-medium whitespace-nowrap";

// Yapay zekanin onerisi uc kutuda: tur, oncelik, birim (Figma: 08 Yeni Stil (A) > Inceleme Kuyrugu)
function Suggestion({ item }: { item: ReviewItem }) {
  const rows: [string, string][] = [
    ["Tür", item.case.case_type?.name ?? "Belirlenmedi"],
    ["Öncelik", item.case.priority ? priorityLabel(item.case.priority) : "Belirlenmedi"],
    ["Birim", item.case.department?.name ?? "Belirlenmedi"],
  ];
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Yapay zekâ önerisi</p>
      {/* Telefonda tur ve oncelik yan yana, uzun birim adi alt satirda tam genislikte */}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border px-3.5 py-2.5 last:col-span-2 sm:last:col-span-1">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Kare kartta baslik kucuk ve iki satirla sinirli (Figma: ReviewTile)
const HEADER_TEXT = {
  row: { title: "text-base font-semibold md:text-lg", location: "text-sm text-muted-foreground" },
  tile: { title: "line-clamp-2 text-sm font-semibold break-words", location: "text-xs text-muted-foreground" },
} as const;

interface ItemHeaderProps {
  item: ReviewItem;
  titleId: string;
  layout?: keyof typeof HEADER_TEXT;
}

export function ItemHeader({ item, titleId, layout = "row" }: ItemHeaderProps) {
  const badge = reviewBadge(item);
  const text = HEADER_TEXT[layout];
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">
          {item.case.case_number} · {relativeTime(item.case.created_at)}
        </p>
        <h2 id={titleId} className={text.title}>
          {item.case.title}
        </h2>
        <p className={cn("flex items-center gap-1", text.location)}>
          <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
          {item.case.location.name}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
        <span className={cn(BADGE_CLASS, TONE_CLASS[badge.tone])}>{badge.label}</span>
        <Confidence value={item.confidence} />
      </div>
    </div>
  );
}

// Kuyruk satiri: neden burada, AI onerisi; altta gerekce bagi ve islemler (Figma: 08 Yeni Stil (A))
export function ReviewItemCard({ item, onDone }: { item: ReviewItem; onDone: (message: string) => void }) {
  const titleId = useId();
  const [showReasons, setShowReasons] = useState(false);
  return (
    <article aria-labelledby={titleId} className="surface">
      <div className="space-y-4 p-4 md:p-6">
        <ItemHeader item={item} titleId={titleId} />
        {item.reason ? (
          <p className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
            <span className="font-semibold">Neden burada?</span> {item.reason}
          </p>
        ) : null}
        {item.possible_duplicate_of ? (
          <p className="text-sm">
            Benzer bildirim:{" "}
            <span className="font-medium text-primary-text">{item.possible_duplicate_of.case_number}</span>,{" "}
            {item.possible_duplicate_of.title}
          </p>
        ) : null}
        <Suggestion item={item} />
        {showReasons ? <DecisionPanel caseId={item.case.id} /> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 md:px-6">
        <Button
          variant="ghost"
          className="-ml-3 h-11 px-3 text-primary-text md:h-9"
          aria-expanded={showReasons}
          onClick={() => setShowReasons(!showReasons)}
        >
          {showReasons ? "Gerekçeyi gizle" : "Yapay zekâ gerekçesi"}
        </Button>
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <ReviewActions item={item} onDone={onDone} />
        </div>
      </div>
    </article>
  );
}
