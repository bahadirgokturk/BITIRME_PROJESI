"use client";

import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useCaseEvents, type CaseEventRead } from "@/hooks/useCases";
import { formatDateTime } from "@/lib/dates";
import { timelineLabel } from "@/lib/timeline";

type EventsQuery = ReturnType<typeof useCaseEvents>;

function TimelineItem({ event }: { event: CaseEventRead }) {
  return (
    <li className="group relative pb-5 pl-6 last:pb-0">
      <span aria-hidden className="absolute top-1.5 left-0 size-2.5 rounded-full bg-primary" />
      <span aria-hidden className="absolute top-5 bottom-0 left-1 w-0.5 bg-border group-last:hidden" />
      <p className="text-sm font-medium">{timelineLabel(event.event_type)}</p>
      <p className="text-xs text-muted-foreground">
        <time dateTime={event.occurred_at}>{formatDateTime(event.occurred_at)}</time>
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
    return (
      <ErrorState
        title="Zaman çizelgesi yüklenemedi."
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return (
    <ol aria-label="Zaman çizelgesi">
      {query.data.map((event) => (
        <TimelineItem key={event.id} event={event} />
      ))}
    </ol>
  );
}

export function CaseTimeline({ caseId }: { caseId: string }) {
  const query = useCaseEvents(caseId);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Zaman çizelgesi</h2>
      <TimelineBody query={query} />
    </section>
  );
}
