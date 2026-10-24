"use client";

import { processMapHeadline, processMapSubtitle, variantRows, waitRows, type ProcessMapRead } from "@/lib/reports";

import { BarList } from "../BarList";
import { ChartCard } from "../dashboard/ChartCard";
import { ShowAllButton, useShowAll } from "./ShowAll";

const PATHS_TITLE = "En sık yollar";
const WAITS_TITLE = "Adımlar arası bekleme";
const SECTION_CLASS = "min-w-0 space-y-3";
const SECTION_TITLE_CLASS = "text-sm font-semibold";

function PathsSection({ map }: { map: ProcessMapRead }) {
  const rows = variantRows(map);
  const { visible, showAll, hasMore, toggle } = useShowAll(rows);
  return (
    <section className={SECTION_CLASS}>
      <h3 className={SECTION_TITLE_CLASS}>{PATHS_TITLE}</h3>
      <BarList label={PATHS_TITLE} items={visible} />
      {hasMore && <ShowAllButton showAll={showAll} totalText={`${rows.length} yolun`} onClick={toggle} />}
    </section>
  );
}

function WaitsSection({ map }: { map: ProcessMapRead }) {
  const rows = waitRows(map);
  const { visible, showAll, hasMore, toggle } = useShowAll(rows);
  return (
    <section className={SECTION_CLASS}>
      <h3 className={SECTION_TITLE_CLASS}>{WAITS_TITLE}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ölçülecek kadar tekrarlanan bir adım yok.</p>
      ) : (
        <BarList label={WAITS_TITLE} items={visible} />
      )}
      {hasMore && <ShowAllButton showAll={showAll} totalText={`${rows.length} adımın`} onClick={toggle} />}
    </section>
  );
}

// Surec haritasi (surec madenciligi, docs/ANALYTICS.md): bildirimlerin izledigi yollar ve adimlar arasi
// bekleme; en uzun bekleme darbogazdir (Figma: 05 Manager > /manager/analytics > ProcessMapCard)
export function ProcessMapCard({ map }: { map: ProcessMapRead }) {
  return (
    <ChartCard title={processMapHeadline(map)} subtitle={processMapSubtitle(map)}>
      {map.variants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu dönemde izlenecek bildirim yok.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <PathsSection map={map} />
          <WaitsSection map={map} />
        </div>
      )}
    </ChartCard>
  );
}
