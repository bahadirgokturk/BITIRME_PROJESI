import Link from "next/link";

import { PriorityBadge, SlaBadge } from "@/components/tasks/TaskBadges";
import { Skeleton } from "@/components/ui/skeleton";
import { CASE_STATUS_LABELS, caseSla, caseSubtitle, type CaseRead } from "@/lib/caseList";
import { formatDateTime, relativeTime } from "@/lib/dates";

// Masaustunde tablo sutunlari: numara, baslik, birim, durum, oncelik, kalan sure, acilis.
// Telefonda ayni ogeler kart icinde alt alta dizilir (tek DOM, iki yerlesim).
export const COLUMNS_CLASS = "md:grid md:grid-cols-[104px_minmax(0,1fr)_168px_150px_88px_140px_104px] md:items-center md:gap-x-4";
const ROW_CLASS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 rounded-lg border bg-card p-3.5 " +
  "md:rounded-none md:border-0 md:border-t md:bg-transparent md:px-0 md:py-3";
const NO_VALUE = "–";

export const COLUMN_HEADERS = ["Bildirim no", "Başlık, tür ve konum", "Birim", "Durum", "Öncelik", "Kalan süre", "Açılış"];

function StatusBadge({ status }: { status: CaseRead["status"] }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-xs font-medium">
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}

export function CaseRow({ item }: { item: CaseRead }) {
  const sla = caseSla(item);
  return (
    <Link
      href={`/cases/${item.id}`}
      className={`${ROW_CLASS} ${COLUMNS_CLASS} transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50`}
    >
      <span className="text-xs text-muted-foreground md:text-sm">{item.case_number}</span>
      <span className="col-span-2 md:col-span-1">
        <span className="block text-sm font-medium">{item.title}</span>
        <span className="block text-xs text-muted-foreground">{caseSubtitle(item)}</span>
      </span>
      <span className="col-span-2 text-xs text-muted-foreground md:col-span-1 md:text-sm md:text-foreground">
        {item.department?.name ?? NO_VALUE}
      </span>
      {/* Telefonda durum rozeti kartin sag ust kosesinde, numaranin karsisinda durur */}
      <span className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start">
        <StatusBadge status={item.status} />
      </span>
      <span className="col-span-2 flex items-center gap-1.5 md:contents">
        <span>{item.priority ? <PriorityBadge priority={item.priority} /> : <span className="hidden text-sm text-muted-foreground md:inline">{NO_VALUE}</span>}</span>
        <span>{sla ? <SlaBadge view={sla} /> : <span className="hidden text-sm text-muted-foreground md:inline">{NO_VALUE}</span>}</span>
        <time
          dateTime={item.created_at}
          title={formatDateTime(item.created_at)}
          className="ml-auto text-xs text-muted-foreground md:ml-0 md:text-sm"
        >
          {relativeTime(item.created_at)}
        </time>
      </span>
    </Link>
  );
}

export function CaseRowSkeleton() {
  return (
    <div className={`${ROW_CLASS} md:block`}>
      <Skeleton className="h-3 w-24 md:hidden" />
      <Skeleton className="col-span-2 h-4 w-4/5 md:w-full" />
      <Skeleton className="col-span-2 h-3 w-3/5 md:hidden" />
    </div>
  );
}
