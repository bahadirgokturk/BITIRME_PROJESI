"use client";

import { useState } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { useCaseList } from "@/hooks/useCases";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ApiError } from "@/lib/api/client";
import { DEFAULT_FILTERS, isFiltered, shownSummary, type CaseFilters as Filters } from "@/lib/caseList";

import { CaseFilters } from "./CaseFilters";
import { CaseRow, CaseRowSkeleton, COLUMN_HEADERS, COLUMNS_CLASS } from "./CaseRow";

// Yazmayi biraktiktan bu kadar sonra aranir (her tus vurusunda istek atilmaz)
const SEARCH_DELAY_MS = 300;
const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"];
// Masaustunde satirlar tek bir kartin icinde, telefonda her satir ayri kart
const LIST_CLASS = "grid gap-3 md:gap-0 md:rounded-lg md:border md:bg-card md:px-5";
// Backend cevap vermediyse (ag sorunu) gosterilen metin; cevap verdiyse onun mesaji (UI_GUIDE bolum 6)
const NETWORK_HINT = "Bağlantınızı kontrol edip tekrar deneyin.";

type CaseListQuery = ReturnType<typeof useCaseList>;

function ColumnHeaders() {
  return (
    <div aria-hidden className={`hidden py-2.5 text-xs font-medium text-muted-foreground ${COLUMNS_CLASS}`}>
      {COLUMN_HEADERS.map((header) => (
        <span key={header}>{header}</span>
      ))}
    </div>
  );
}

function Message({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
      {onClear && (
        <Button variant="outline" className="mt-2 h-11 px-4" onClick={onClear}>
          Süzgeçleri temizle
        </Button>
      )}
    </div>
  );
}

// Sonraki sayfa: buton ya da (yuklenemediyse) liste yerinde kalarak hata + Tekrar dene
function Footer({ query, shown, total }: { query: CaseListQuery; shown: number; total: number }) {
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
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-muted-foreground">{shownSummary(shown, total)}</p>
      {query.hasNextPage && (
        <Button
          variant="outline"
          className="h-11 w-full md:h-9 md:w-auto"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Yükleniyor…" : "Daha fazla göster"}
        </Button>
      )}
    </div>
  );
}

function Skeletons() {
  return (
    <div aria-label="Bildirimler yükleniyor" aria-busy="true" className={LIST_CLASS}>
      {SKELETON_KEYS.map((key) => (
        <CaseRowSkeleton key={key} />
      ))}
    </div>
  );
}

function CaseListBody({ query, filtered, onClear }: { query: CaseListQuery; filtered: boolean; onClear: () => void }) {
  if (query.isPending) {
    return <Skeletons />;
  }
  // Ilk sayfa hic gelmediyse tam ekran hata; sonraki sayfa hatasi Footer'da, liste yerinde kalir
  if (query.data === undefined) {
    return <ErrorState title="Bildirimler yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  const { items, total } = query.data;
  if (items.length === 0) {
    return filtered ? (
      <Message
        title="Aramanıza uyan bildirim yok."
        text="Farklı bir kelime deneyin ya da süzgeçleri temizleyin."
        onClear={onClear}
      />
    ) : (
      <Message title="Henüz bildirim yok." text="Bir bildirim geldiğinde burada görünür." />
    );
  }
  return (
    <div className="space-y-3">
      <div className={LIST_CLASS}>
        <ColumnHeaders />
        <ul aria-label="Bildirimler" className="contents">
          {items.map((item) => (
            <li key={item.id}>
              <CaseRow item={item} />
            </li>
          ))}
        </ul>
      </div>
      <Footer query={query} shown={items.length} total={total} />
    </div>
  );
}

// Mudurun butun bildirimleri: arama, suzgec ve sayfalama (docs/UI_GUIDE.md bolum 5.4; Figma: 05 Manager > /manager/cases)
export function CaseList() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const search = useDebouncedValue(filters.search, SEARCH_DELAY_MS);
  const applied = { ...filters, search };
  const query = useCaseList(applied);
  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <header className="space-y-2">
        <PageTitle>Tüm Bildirimler</PageTitle>
        <p className="text-sm text-muted-foreground">
          Kurumdaki bütün bildirimler. Aramak ya da süzmek için aşağıdaki alanları kullanın.
        </p>
      </header>
      <CaseFilters value={filters} onChange={setFilters} />
      <CaseListBody query={query} filtered={isFiltered(applied)} onClear={() => setFilters(DEFAULT_FILTERS)} />
    </div>
  );
}
