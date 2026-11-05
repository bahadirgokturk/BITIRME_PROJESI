"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";

import { collapsedTimeline } from "@/lib/timeline";

interface CollapsibleTimelineProps<T> {
  events: readonly T[];
  renderItem: (event: T) => ReactNode;
}

// Uzun cizelgede once son adimlar; oncekiler dugmeyle acilir (lib/timeline.ts collapsedTimeline).
// Bildirenin ve mudur/personelin cizelgesi ayni davranir (Figma: /cases/[id] - zaman cizelgesi acik,
// /manager/cases/[id]); her biri kendi satirini renderItem ile cizer.
export function CollapsibleTimeline<T>({ events, renderItem }: CollapsibleTimelineProps<T>) {
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
      <ol aria-label="Zaman çizelgesi">{visible.map(renderItem)}</ol>
    </div>
  );
}
