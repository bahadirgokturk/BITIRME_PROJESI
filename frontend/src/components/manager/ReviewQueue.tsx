"use client";

import { useState } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { ViewToggle } from "@/components/lists/ListToolbar";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useListView } from "@/hooks/useListView";
import { useReviewQueue } from "@/hooks/useReview";
import type { ListView } from "@/lib/listTools";

import { ReviewItemCard } from "./ReviewItemCard";
import { ReviewTile } from "./ReviewTile";

// Iskelet kart sayisi: tasarimdaki ornek kuyruk kadar (Figma: /manager/review-queue - yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3"];

// Kart gorunumu: telefonda tek sutun (dort islem dugmesi iki sutuna sigmaz), genis ekranda uc sutun
const LIST_CLASS: Record<ListView, string> = {
  list: "space-y-3",
  grid: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
};

type QueueQuery = ReturnType<typeof useReviewQueue>;

interface QueueBodyProps {
  query: QueueQuery;
  view: ListView;
  onDone: (message: string) => void;
}

function QueueBody({ query, view, onDone }: QueueBodyProps) {
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
        <p className="text-sm text-muted-foreground">Yapay zekânın emin olamadığı ya da size iletilen bildirimler burada görünür.</p>
      </div>
    );
  }
  const Item = view === "grid" ? ReviewTile : ReviewItemCard;
  return (
    <ul aria-label="İnceleme kuyruğu" data-view={view} className={LIST_CLASS[view]}>
      {query.data.items.map((item) => (
        <li key={item.case.id}>
          <Item item={item} onDone={onDone} />
        </li>
      ))}
    </ul>
  );
}

export function ReviewQueue() {
  const query = useReviewQueue();
  // Son islemin sonucu ekran okuyucuya da duyurulur (kart kuyruktan kayboldugu icin)
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [view, setView] = useListView("review");
  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
        <div className="space-y-3">
          <PageTitle>İnceleme Kuyruğu</PageTitle>
          <p className="text-sm text-muted-foreground">
            Yapay zekânın emin olamadığı ya da size iletilen bildirimler. En kritik ve en eski üstte.
          </p>
        </div>
        {/* Bos kuyrukta sayi da gorunum de yok; telefonda ayri satir: solda sayi, sagda gorunum */}
        {query.isSuccess && query.data.total > 0 ? (
          <div className="flex shrink-0 items-center justify-between gap-3">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{query.data.total} bildirim</span>
            <ViewToggle value={view} onChange={setView} />
          </div>
        ) : null}
      </header>
      <p role="status" className={lastAction ? "rounded-md bg-muted px-3 py-2 text-sm" : "sr-only"}>
        {lastAction}
      </p>
      <QueueBody query={query} view={view} onDone={setLastAction} />
    </div>
  );
}
