"use client";

import Link from "next/link";
import { useState } from "react";

import { FilterChips } from "@/components/filters/FilterChips";
import { PageTitle } from "@/components/layout/PageTitle";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ErrorState } from "@/components/states/ErrorState";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMyCases } from "@/hooks/useCases";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ApiError } from "@/lib/api/client";
import { MY_CASES_FILTERS, type MyCasesFilter } from "@/lib/status";

import { CaseCard, CaseCardSkeleton } from "./CaseCard";
import { WaitingBell } from "./WaitingBell";

// Iskelet kart sayisi: ilk ekranda gorunen kart sayisi kadar (Figma: /my-cases - yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3", "s4"];

type MyCasesQuery = ReturnType<typeof useMyCases>;

// Backend cevap vermediyse (ag sorunu) gosterilen metin; cevap verdiyse onun mesaji (UI_GUIDE bolum 6)
const NETWORK_HINT = "Bağlantınızı kontrol edip tekrar deneyin.";

function ReportLink() {
  return (
    <Link href="/report" className={buttonVariants({ className: "h-12 w-full px-4 md:w-auto" })}>
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

const FILTERED_HINT: Record<Exclude<MyCasesFilter, "all">, string> = {
  open: "Bildirdiğin sorunların hepsi çözülmüş görünüyor.",
  solved: "Çözülen bildirimlerin burada görünecek.",
};

// Filtreye uyan bildirim yok; bildirenin baska bildirimleri vardir (Figma: /my-cases - mobil - filtre bos)
function FilteredEmpty({ filter, onClear }: { filter: Exclude<MyCasesFilter, "all">; onClear: () => void }) {
  const empty = MY_CASES_FILTERS.find((item) => item.value === filter)?.empty;
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">{empty}</p>
      <p className="text-sm text-muted-foreground">{FILTERED_HINT[filter]}</p>
      <Button className="mt-2 h-11 px-4" onClick={onClear}>
        Tümünü göster
      </Button>
    </div>
  );
}

// Sonraki sayfa: buton ya da (yuklenemediyse) liste yerinde kalarak hata + Tekrar dene
function LoadMore({ query }: { query: MyCasesQuery }) {
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

interface MyCasesBodyProps {
  query: MyCasesQuery;
  filter: MyCasesFilter;
  onClear: () => void;
}

function MyCasesBody({ query, filter, onClear }: MyCasesBodyProps) {
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
    return (
      <ErrorState
        title="Bildirimleriniz yüklenemedi."
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.data.length === 0) {
    return filter === "all" ? <EmptyState /> : <FilteredEmpty filter={filter} onClear={onClear} />;
  }
  return (
    <div className="space-y-3">
      <ul aria-label="Bildirimleriniz" className="grid gap-3">
        {query.data.map((item) => (
          <li key={item.id}>
            <CaseCard item={item} />
          </li>
        ))}
      </ul>
      <LoadMore query={query} />
    </div>
  );
}

export function MyCasesList() {
  const [filter, setFilter] = useState<MyCasesFilter>("all");
  const query = useMyCases(filter);
  const user = useCurrentUser();
  // Hic bildirimi yoksa: buton ortadaki metnin altinda, filtre de gosterilmez
  const isEmpty = filter === "all" && query.isSuccess && query.data.length === 0;
  // Filtre yalniz bildirene: /cases kapsami baska rollerde kendi bildirimlerinden genistir (lib/status.ts)
  const canFilter = user.data?.role === "REPORTER" && !isEmpty;
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4 md:space-y-6">
      {/* Uygulama yukleme daveti ilk bildirimden sonra gosterilir (Figma: /my-cases - yukleme daveti) */}
      <InstallPrompt hasCases={query.isSuccess && !isEmpty} />
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageTitle>Bildirimlerim</PageTitle>
        {/* Masaustunde zil "Bildirim yap"in solunda; telefonda zil ust cubukta (MobileAppBar) */}
        <div className="flex w-full items-center gap-2 md:w-auto">
          {/* "Bildirim yap" ile ayni yukseklik (h-12) */}
          <WaitingBell className="hidden md:inline-flex md:size-12" />
          {isEmpty ? null : <ReportLink />}
        </div>
      </header>
      {canFilter && <FilterChips label="Durum" options={MY_CASES_FILTERS} value={filter} onChange={setFilter} />}
      <MyCasesBody query={query} filter={filter} onClear={() => setFilter("all")} />
    </div>
  );
}
