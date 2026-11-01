"use client";

import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/states/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentMetrics } from "@/hooks/useAnalytics";
import type { SummaryPeriod } from "@/lib/analytics";
import { agentKpis, agentRows, mostCorrectedHeadline, type AgentMetricsRead } from "@/lib/agentMetrics";

import { ChartCard, PanelSkeleton } from "../dashboard/ChartCard";
import { PeriodSwitch } from "../PeriodSwitch";
import { StatTable } from "../StatTable";

// Genel Bakis rakam kartlariyla ayni gorunum (Figma: 08 Yeni Stil (A) > Yapay Zeka Performansi)
const CARD_CLASS = "surface-kpi p-4 md:px-5";
const GRID_CLASS = "grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4";
const STACK_CLASS = "space-y-4 md:space-y-6";
const SKELETON_KEYS = ["k1", "k2", "k3", "k4"];
const SUBTITLE = "Yapay zekâ adımlarına göre karar sayısı, güven ve düzeltilme";
const COLUMNS = ["Karar sayısı", "Ortalama güven", "Düzeltilme oranı"];
const NOTE =
  "Ortalama güven: yapay zekânın kararından ne kadar emin olduğu. Düzeltilme oranı: müdürün kararı değiştirdiği durumlar.";

function RateCards({ metrics }: { metrics: AgentMetricsRead }) {
  return (
    <ul aria-label="Temel göstergeler" className={GRID_CLASS}>
      {agentKpis(metrics).map((card) => (
        <li key={card.label} role="group" aria-label={card.label} className={CARD_CLASS}>
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">{card.value}</p>
          <p className="mt-2 text-xs text-muted-foreground md:text-sm">{card.hint}</p>
        </li>
      ))}
    </ul>
  );
}

function StepsCard({ metrics }: { metrics: AgentMetricsRead }) {
  const rows = agentRows(metrics.agents).map((row) => ({
    key: row.key,
    name: row.name,
    cells: [row.decisions, row.confidence, row.overrideRate],
  }));
  return (
    <ChartCard
      title={mostCorrectedHeadline(metrics.agents)}
      subtitle={SUBTITLE}
      footer={rows.length === 0 ? null : NOTE}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu dönemde yapay zekâ kararı yok.</p>
      ) : (
        <StatTable label={SUBTITLE} nameHeader="Adım" columns={COLUMNS} rows={rows} />
      )}
    </ChartCard>
  );
}

function PerformanceSkeleton() {
  return (
    <div aria-label="Yapay zekâ performansı yükleniyor" aria-busy="true" className={STACK_CLASS}>
      <div className={GRID_CLASS}>
        {SKELETON_KEYS.map((key) => (
          <div key={key} className={`${CARD_CLASS} space-y-2.5`}>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <PanelSkeleton />
    </div>
  );
}

function PerformanceBody({ period }: { period: SummaryPeriod }) {
  const metrics = useAgentMetrics(period);
  if (metrics.isError) {
    return (
      <ErrorState title="Yapay zekâ performansı yüklenemedi." error={metrics.error} onRetry={() => void metrics.refetch()} />
    );
  }
  if (!metrics.data) {
    return <PerformanceSkeleton />;
  }
  return (
    <div className={STACK_CLASS}>
      <RateCards metrics={metrics.data} />
      <StepsCard metrics={metrics.data} />
    </div>
  );
}

// Yapay zeka performans ekrani (docs/UI_GUIDE.md bolum 5.4; Figma: 05 Manager > /manager/agents)
export function AgentPerformance() {
  const [period, setPeriod] = useState<SummaryPeriod>("7d");
  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <PageHeader
        title="Yapay Zekâ Performansı"
        description="Sistemin kendi başına verdiği kararlar ve bunların ne kadarının düzeltildiği."
        actions={<PeriodSwitch value={period} onChange={setPeriod} />}
      />
      <PerformanceBody period={period} />
    </div>
  );
}
