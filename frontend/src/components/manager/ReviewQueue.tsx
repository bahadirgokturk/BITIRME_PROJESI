"use client";

import { useState } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useReviewQueue } from "@/hooks/useReview";

import { ReviewItemCard } from "./ReviewItemCard";

// Iskelet kart sayisi: tasarimdaki ornek kuyruk kadar (Figma: /manager/review-queue - yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3"];

type QueueQuery = ReturnType<typeof useReviewQueue>;

function QueueBody({ query, onDone }: { query: QueueQuery; onDone: (message: string) => void }) {
  if (query.isPending) {
    return (
      <ul aria-label="İnceleme kuyruğu yükleniyor" aria-busy="true" className="space-y-3">
        {SKELETON_KEYS.map((key) => (
          <li key={key} className="space-y-2.5 rounded-xl border p-5">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-9 w-1/3" />
          </li>
        ))}
      </ul>
    );
  }
  if (query.isError) {
    return <ErrorState title="İnceleme kuyruğu yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.data.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-semibold">İncelenecek bildirim yok.</p>
        <p className="text-sm text-muted-foreground">AI&apos;ın emin olamadığı ya da size iletilen bildirimler burada görünür.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {query.data.items.map((item) => (
        <ReviewItemCard key={item.case.id} item={item} onDone={onDone} />
      ))}
    </div>
  );
}

export function ReviewQueue() {
  const query = useReviewQueue();
  // Son islemin sonucu ekran okuyucuya da duyurulur (kart kuyruktan kayboldugu icin)
  const [lastAction, setLastAction] = useState<string | null>(null);
  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <PageTitle>İnceleme Kuyruğu</PageTitle>
          <p className="text-sm text-muted-foreground">
            AI&apos;ın emin olamadığı ya da size iletilen bildirimler. En kritik ve en eski üstte.
          </p>
        </div>
        {query.isSuccess && query.data.total > 0 ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{query.data.total} bildirim</span>
        ) : null}
      </header>
      <p role="status" className={lastAction ? "rounded-md bg-muted px-3 py-2 text-sm" : "sr-only"}>
        {lastAction}
      </p>
      <QueueBody query={query} onDone={setLastAction} />
    </div>
  );
}
