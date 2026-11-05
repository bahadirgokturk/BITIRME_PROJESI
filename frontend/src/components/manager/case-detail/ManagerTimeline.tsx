"use client";

import { CollapsibleTimeline } from "@/components/cases/CollapsibleTimeline";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useCaseEvents, type CaseEventRead } from "@/hooks/useCases";
import { formatDateTime } from "@/lib/dates";
import { eventActor, managerEventLabel } from "@/lib/managerCase";

import { CARD_CLASS } from "./CaseSummary";

type EventsQuery = ReturnType<typeof useCaseEvents>;

// Her olay: ne oldu, kim yapti (yapay zeka adimi, sistem ya da kisi), ne zaman
function TimelineItem({ event }: { event: CaseEventRead }) {
  return (
    <li className="group relative pb-4 pl-6 last:pb-0">
      <span aria-hidden className="absolute top-1.5 left-0 size-2.5 rounded-full bg-primary" />
      <span aria-hidden className="absolute top-5 bottom-0 left-1 w-0.5 bg-border group-last:hidden" />
      <p className="text-sm font-medium">{managerEventLabel(event)}</p>
      <p className="text-xs text-muted-foreground">
        {eventActor(event)} · <time dateTime={event.occurred_at}>{formatDateTime(event.occurred_at)}</time>
      </p>
    </li>
  );
}

function TimelineBody({ query }: { query: EventsQuery }) {
  if (query.isPending) {
    return (
      <div aria-label="Zaman çizelgesi yükleniyor" aria-busy="true" className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState title="Zaman çizelgesi yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  // Uzun cizelgede once son uc adim; oncekiler dugmeyle acilir (Figma: /manager/cases/[id])
  return <CollapsibleTimeline events={query.data} renderItem={(event) => <TimelineItem key={event.id} event={event} />} />;
}

// Mudurun zaman cizelgesi: bildirenin gordugunden ayrintili (Figma: 05 Manager > /manager/cases/[id])
export function ManagerTimeline({ caseId }: { caseId: string }) {
  const query = useCaseEvents(caseId);
  return (
    <section className={`${CARD_CLASS} space-y-3`}>
      <h2 className="text-base font-semibold">Zaman çizelgesi</h2>
      <TimelineBody query={query} />
    </section>
  );
}
