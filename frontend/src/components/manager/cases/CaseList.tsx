"use client";

import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ExportButton } from "@/components/export/ExportButton";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { fetchAllCases, useCaseList } from "@/hooks/useCases";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListView } from "@/hooks/useListView";
import { ApiError } from "@/lib/api/client";
import { casesSheet } from "@/lib/exportSheets";
import type { ListView } from "@/lib/listTools";
import {
  CASE_LIST_VIEWS,
  DEFAULT_FILTERS,
  isFiltered,
  shownSummary,
  type CaseFilters as Filters,
  type CaseRead,
  type CaseListView,
  type StatusGroup,
} from "@/lib/caseList";

import { CaseFilters } from "./CaseFilters";
import { CaseRow, CaseRowSkeleton, COLUMN_HEADERS, COLUMNS_CLASS } from "./CaseRow";
import { ManagerCaseTile } from "./CaseTile";

// Yazmayi biraktiktan bu kadar sonra aranir (her tus vurusunda istek atilmaz)
const SEARCH_DELAY_MS = 300;
const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"];
// Masaustunde satirlar tek bir kartin icinde, telefonda her satir ayri kart
// Masaustunde cerceveli tablo, gri baslik satiri (Figma: 08 Yeni Stil (A) > Tum Bildirimler)
const LIST_CLASS = "grid gap-3 md:gap-0 md:overflow-hidden md:rounded-xl md:border md:bg-card md:shadow-xs";
// Kart gorunumu: telefonda iki, tablette uc, genis ekranda dort sutun kare kart
const GRID_CLASS = "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4";
// Backend cevap vermediyse (ag sorunu) gosterilen metin; cevap verdiyse onun mesaji (UI_GUIDE bolum 6)
const NETWORK_HINT = "Bağlantınızı kontrol edip tekrar deneyin.";

type CaseListQuery = ReturnType<typeof useCaseList>;

function ColumnHeaders() {
  return (
    <div aria-hidden className={`hidden h-10 bg-muted px-4 text-sm font-medium ${COLUMNS_CLASS}`}>
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
          Filtreleri temizle
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

interface CaseListBodyProps {
  query: CaseListQuery;
  filtered: boolean;
  onClear: () => void;
  listPath: string;
  layout: ListView;
}

function CaseListBody({ query, filtered, onClear, listPath, layout }: CaseListBodyProps) {
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
        text="Farklı bir kelime deneyin ya da filtreleri temizleyin."
        onClear={onClear}
      />
    ) : (
      <Message title="Henüz bildirim yok." text="Bir bildirim geldiğinde burada görünür." />
    );
  }
  return (
    <div className="space-y-3">
      <CaseItems items={items} listPath={listPath} layout={layout} />
      <Footer query={query} shown={items.length} total={total} />
    </div>
  );
}

function CaseItems({ items, listPath, layout }: { items: CaseRead[]; listPath: string; layout: ListView }) {
  if (layout === "grid") {
    return (
      <ul aria-label="Bildirimler" data-view="grid" className={GRID_CLASS}>
        {items.map((item) => (
          <li key={item.id}>
            <ManagerCaseTile item={item} listPath={listPath} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className={LIST_CLASS}>
      <ColumnHeaders />
      <ul aria-label="Bildirimler" data-view="list" className="contents">
        {items.map((item) => (
          <li key={item.id}>
            <CaseRow item={item} listPath={listPath} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Butun bildirimler (mudur, yonetici) ya da birim bildirimleri (personel): arama, filtre ve sayfalama
// (docs/UI_GUIDE.md bolum 5.4; Figma: 05 Manager > /manager/cases, 04 Staff > /staff/cases)
interface CaseListProps {
  view?: CaseListView;
  // Pano kartindan gelince liste o durum grubuyla acilir
  initialGroup?: StatusGroup;
}

export function CaseList({ view = "all", initialGroup = "all" }: CaseListProps) {
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, group: initialGroup });
  const [layout, setLayout] = useListView("cases");
  const search = useDebouncedValue(filters.search, SEARCH_DELAY_MS);
  const applied = { ...filters, search };
  const query = useCaseList(applied);
  const { title, description, path, exportName } = CASE_LIST_VIEWS[view];
  // Liste 20'ser yuklenir; dosyaya ayni suzgecle butun bildirimler yazilir
  const exportButton = (
    <ExportButton
      compact
      fileName={exportName}
      disabled={!query.data?.total}
      load={async () => casesSheet(await fetchAllCases(applied), title)}
    />
  );
  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <PageHeader title={title} description={description} />
      <CaseFilters value={filters} view={layout} onChange={setFilters} onView={setLayout} extra={exportButton} />
      <CaseListBody
        query={query}
        filtered={isFiltered(applied)}
        onClear={() => setFilters({ ...DEFAULT_FILTERS, order: filters.order })}
        listPath={path}
        layout={layout}
      />
    </div>
  );
}
