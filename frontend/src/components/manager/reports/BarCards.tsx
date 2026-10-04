import { barPercent, formatMinutes } from "@/lib/analytics";
import {
  agingHeadline,
  agingNote,
  bottleneckHeadline,
  busiestLocationHeadline,
  isBottleneck,
  locationRows,
  slaHeadline,
  slaRows,
  slaSummary,
  type AgingRead,
  type LocationsRead,
  type ProcessRead,
  type SlaRead,
} from "@/lib/reports";

import { BarList, type BarItem } from "../BarList";
import { ChartCard } from "../dashboard/ChartCard";

const NOTE_CLASS = "text-xs text-muted-foreground";
const EMPTY_CLASS = "text-sm text-muted-foreground";

export function LocationsCard({ locations }: { locations: LocationsRead }) {
  const subtitle = "Binaya göre bildirim sayısı";
  const items: BarItem[] = locationRows(locations).map((row) => ({
    key: row.id,
    label: row.name,
    value: String(row.count),
    percent: row.percent,
    hint: row.hint,
  }));
  return (
    <ChartCard title={busiestLocationHeadline(locations)} subtitle={subtitle} className="h-full">
      {items.length === 0 ? <p className={EMPTY_CLASS}>Bu dönemde bildirim yok.</p> : <BarList label={subtitle} items={items} />}
    </ChartCard>
  );
}

export function SlaCard({ sla }: { sla: SlaRead }) {
  const subtitle = "Hedef süreye (SLA) uyum, önceliğe göre";
  const items: BarItem[] = slaRows(sla).map((row) => ({ ...row, key: row.priority }));
  return (
    <ChartCard title={slaHeadline(sla)} subtitle={subtitle} className="h-full">
      {sla.with_sla === 0 ? (
        <p className={EMPTY_CLASS}>Bu dönemde hedef süresi olan bildirim yok.</p>
      ) : (
        <>
          <BarList label={subtitle} items={items} />
          <p className={NOTE_CLASS}>{slaSummary(sla)}</p>
        </>
      )}
    </ChartCard>
  );
}

export function AgingCard({ aging }: { aging: AgingRead }) {
  const subtitle = "Açık bildirimler ne kadar süredir bekliyor";
  const max = Math.max(0, ...aging.buckets.map((bucket) => bucket.count));
  // Ust siniri olmayan son kova (en eski bildirimler) kirmizi cizilir ve altta notla da soylenir
  const items: BarItem[] = aging.buckets.map((bucket) => ({
    key: bucket.label,
    label: bucket.label,
    value: String(bucket.count),
    percent: barPercent(bucket.count, max),
    tone: bucket.max_hours === null ? "danger" : "primary",
  }));
  const note = agingNote(aging);
  return (
    <ChartCard title={agingHeadline(aging)} subtitle={subtitle} className="h-full">
      {aging.total_open === 0 ? (
        <p className={EMPTY_CLASS}>Şu anda açık bildirim yok.</p>
      ) : (
        <>
          <BarList label={subtitle} items={items} />
          {note && <p className={NOTE_CLASS}>{note}</p>}
        </>
      )}
    </ChartCard>
  );
}

export function ProcessCard({ process }: { process: ProcessRead }) {
  const subtitle = "Bir bildirimin adımları arasında geçen tipik süre";
  const max = Math.max(0, ...process.steps.map((step) => step.median_min ?? 0));
  const items: BarItem[] = process.steps.map((step) => {
    const slowest = isBottleneck(step, process);
    return {
      key: `${step.from_event}-${step.to_event}`,
      label: step.label,
      value: formatMinutes(step.median_min),
      percent: barPercent(step.median_min ?? 0, max),
      tone: slowest ? "warning" : "primary",
      badge: slowest ? "En yavaş" : undefined,
    };
  });
  return (
    <ChartCard title={bottleneckHeadline(process)} subtitle={subtitle} className="h-full">
      {items.length === 0 ? <p className={EMPTY_CLASS}>Bu dönemde ölçülecek adım yok.</p> : <BarList label={subtitle} items={items} />}
    </ChartCard>
  );
}
