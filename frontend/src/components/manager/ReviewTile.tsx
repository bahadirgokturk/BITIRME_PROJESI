"use client";

import Link from "next/link";
import { useId } from "react";

import type { ReviewItem } from "@/hooks/useReview";
import { suggestionSummary } from "@/lib/review";

import { ItemHeader } from "./ReviewItemCard";
import { ReviewActions } from "./ReviewActions";

const DETAIL_LINK_CLASS =
  "ml-auto inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-primary outline-none " +
  "hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

// Inceleme kuyrugu kare karti: neden ve oneri kisaltilir, islemler aynen kalir; AI gerekcesi bildirim
// ayrintisinda okunur (Figma: ReviewTile; /manager/review-queue - masaustu/mobil - kart gorunumu)
export function ReviewTile({ item, onDone }: { item: ReviewItem; onDone: (message: string) => void }) {
  const titleId = useId();
  return (
    <article aria-labelledby={titleId} className="flex h-full flex-col gap-2.5 rounded-lg border bg-card p-4">
      <ItemHeader item={item} titleId={titleId} layout="tile" />
      {item.reason ? <p className="line-clamp-2 text-xs">{item.reason}</p> : null}
      {item.possible_duplicate_of ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs">
          Benzer bildirim: {item.possible_duplicate_of.case_number} · {item.possible_duplicate_of.title}
        </p>
      ) : null}
      <p className="line-clamp-2 text-xs text-muted-foreground">{suggestionSummary(item)}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <ReviewActions item={item} onDone={onDone} />
        <Link href={`/manager/cases/${item.case.id}`} className={DETAIL_LINK_CLASS}>
          Ayrıntı
        </Link>
      </div>
    </article>
  );
}
