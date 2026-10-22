"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useCaseEvents, type CaseEventRead } from "@/hooks/useCases";
import { formatDateTime } from "@/lib/dates";
import { collapsedTimeline, timelineLabel } from "@/lib/timeline";

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
  return <Timeline events={query.data} />;
}

// Uzun cizelgede once son adimlar; oncekiler dugmeyle acilir (Figma: /cases/[id] - zaman cizelgesi acik)
function Timeline({ events }: { events: readonly CaseEventRead[] }) {
  const [expanded, setExpanded] = useState(false);
  const { visible, hidden } = collapsedTimeline(events, expanded);
  const Icon = expanded ? ChevronUp : ChevronDown;
  return (
    <div className="space-y-1">
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {expanded ? "Önceki adımları gizle" : `${hidden} önceki adımı göster`}
          <Icon aria-hidden className="size-4" />
        </button>
      )}
      <ol aria-label="Zaman çizelgesi">
        {visible.map((event) => (
          <TimelineItem key={event.id} event={event} />
        ))}
      </ol>
    </div>
  );
}

export function CaseTimeline({ caseId }: { caseId: string }) {
  const query = useCaseEvents(caseId);
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Zaman çizelgesi</h2>
      <TimelineBody query={query} />
    </section>
  );
}
