"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "cn";

import { FilterChips } from "@/components/filters/FilterChips";
import { PageTitle } from "@/components/layout/PageTitle";
import { ListToolbar } from "@/components/lists/ListToolbar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { PendingReports } from "@/components/report/PendingReports";
import { ErrorState } from "@/components/states/ErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMyCases } from "@/hooks/useCases";
import { useListView } from "@/hooks/useListView";
import { ApiError } from "@/lib/api/client";
import { CASE_ORDERS, type ListView } from "@/lib/listTools";
import { isMyCasesFiltered, MY_CASES_FILTERS, myCasesEmpty, type MyCasesQuery } from "@/lib/status";

import { CaseCard, CaseCardSkeleton } from "./CaseCard";
import { CaseTile } from "./CaseTile";
import { WaitingBell } from "./WaitingBell";

// Iskelet kart sayisi: ilk ekranda gorunen kart sayisi kadar (Figma: /my-cases - yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3", "s4"];

type CasesQuery = ReturnType<typeof useMyCases>;

// Backend cevap vermediyse (ag sorunu) gosterilen metin; cevap verdiyse onun mesaji (UI_GUIDE bolum 6)
const NETWORK_HINT = "Bağlantınızı kontrol edip tekrar deneyin.";

function ReportLink() {
  return (
    <Link href="/report" className={cn(buttonVariants({ className: "h-12 w-full px-4 md:w-auto" }))}>
      Bildirim yap
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Henüz bildiriminiz yok.</p>
      <p className="text-sm text-muted-foreground">
        Kampüste gördüğün bir sorunu birkaç saniyede bildirebilirsin.
      </p>
      <div className="mt-2">
        <ReportLink />
      </div>
    </div>
  );
}

// Filtreye uyan bildirim yok; kisinin baska bildirimleri vardir (Figma: /my-cases - mobil - filtre bos)
function FilteredEmpty({ query, onClear }: { query: MyCasesQuery; onClear: () => void }) {
  const { title, hint } = myCasesEmpty(query);
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <Button className="mt-2 h-11 px-4" onClick={onClear}>
        Tümünü göster
      </Button>
    </div>
  );
}

// Sonraki sayfa: buton ya da (yuklenemediyse) liste yerinde kalarak hata + Tekrar dene
function LoadMore({ query }: { query: CasesQuery }) {
  if (query.isFetchNextPageError) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 p-3 text-sm">
        <p className="text-destructive">{query.error instanceof ApiError ? query.error.message : NETWORK_HINT}</p>
        <Button variant="outline" className="h-11 px-4" onClick={() => void query.fetchNextPage()}>
          Tekrar dene
        </Button>
      </div>
    );
  }
  if (!query.hasNextPage) {
    return null;
  }
  return (
    <Button
      variant="outline"
      className="h-11 w-full"
      disabled={query.isFetchingNextPage}
      onClick={() => void query.fetchNextPage()}
    >
      {query.isFetchingNextPage ? "Yükleniyor…" : "Daha fazla göster"}
    </Button>
  );
}

// Liste: tek sutun tam kart; kart gorunumu: telefonda iki, genis ekranda uc sutun kare kart
const LIST_CLASS: Record<ListView, string> = {
  list: "grid gap-3",
  grid: "grid grid-cols-2 gap-3 md:grid-cols-3",
};

function CaseItems({ items, view }: { items: NonNullable<CasesQuery["data"]>; view: ListView }) {
  return (
    <ul aria-label="Bildirimleriniz" data-view={view} className={LIST_CLASS[view]}>
      {items.map((item) => (
        <li key={item.id}>{view === "grid" ? <CaseTile item={item} /> : <CaseCard item={item} />}</li>
      ))}
    </ul>
  );
}

interface MyCasesBodyProps {
  query: CasesQuery;
  filters: MyCasesQuery;
  view: ListView;
  onClear: () => void;
}

function MyCasesBody({ query, filters, view, onClear }: MyCasesBodyProps) {
  if (query.isPending) {
    return (
      <ul aria-label="Bildirimler yükleniyor" aria-busy="true" className="grid gap-3">
        {SKELETON_KEYS.map((key) => (
          <li key={key}>
            <CaseCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }
  // Ilk sayfa hic gelmediyse tam ekran hata; sonraki sayfa hatasi LoadMore'da, liste yerinde kalir
  if (query.data === undefined) {
    return <ErrorState title="Bildirimleriniz yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.data.length === 0) {
    return isMyCasesFiltered(filters) ? <FilteredEmpty query={filters} onClear={onClear} /> : <EmptyState />;
  }
  return (
    <div className="space-y-3">
      <CaseItems items={query.data} view={view} />
      <LoadMore query={query} />
    </div>
  );
}

const ALL: MyCasesQuery = { status: "all", priorities: [], order: "newest" };

export function MyCasesList() {
  const [filters, setFilters] = useState<MyCasesQuery>(ALL);
  const [view, setView] = useListView("my-cases");
  const query = useMyCases(filters);
  // Hic bildirimi yoksa: buton ortadaki metnin altinda, filtre ve araclar da gosterilmez
  const isEmpty = !isMyCasesFiltered(filters) && query.isSuccess && query.data.length === 0;
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4 md:space-y-6">
      {/* Uygulama yukleme daveti ilk bildirimden sonra gosterilir (Figma: /my-cases - yukleme daveti) */}
      <InstallPrompt hasCases={query.isSuccess && !isEmpty} />
      <MyCasesHeader isEmpty={isEmpty} />
      <PendingReports />
      {isEmpty ? null : (
        <div className="space-y-3">
          <FilterChips
            label="Durum"
            options={MY_CASES_FILTERS}
            value={filters.status}
            onChange={(status) => setFilters({ ...filters, status })}
          />
          <ListToolbar
            tools={filters}
            orders={CASE_ORDERS}
            view={view}
            onTools={(tools) => setFilters({ ...filters, ...tools })}
            onView={setView}
          />
        </div>
      )}
      <MyCasesBody query={query} filters={filters} view={view} onClear={() => setFilters({ ...ALL, order: filters.order })} />
    </div>
  );
}

function MyCasesHeader({ isEmpty }: { isEmpty: boolean }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <PageTitle>Bildirimlerim</PageTitle>
      {/* Masaustunde zil "Bildirim yap"in solunda; telefonda zil ust cubukta (MobileAppBar) */}
      <div className="flex w-full items-center gap-2 md:w-auto">
        {/* "Bildirim yap" ile ayni yukseklik (h-12) */}
        <WaitingBell className="hidden md:inline-flex md:size-12" />
        {isEmpty ? null : <ReportLink />}
      </div>
    </header>
  );
}
