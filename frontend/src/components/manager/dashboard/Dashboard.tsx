"use client";

import { useState } from "react";

import { cn } from "cn";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { useCategories, useKpis, useTrend } from "@/hooks/useAnalytics";
import { PERIODS, periodDays, type SummaryPeriod } from "@/lib/analytics";

import { AiSummary, AiSummaryEmpty } from "./AiSummary";
import { CategoryBars } from "./CategoryBars";
import { PanelSkeleton } from "./ChartCard";
import { KpiGrid, KpiGridSkeleton } from "./KpiGrid";
import { TrendChart } from "./TrendChart";

const CHARTS_CLASS = "grid gap-4 lg:grid-cols-3";
const TREND_SPAN = "lg:col-span-2";

interface PeriodSwitchProps {
  value: SummaryPeriod;
  onChange: (period: SummaryPeriod) => void;
}

function PeriodSwitch({ value, onChange }: PeriodSwitchProps) {
  return (
    <div role="group" aria-label="Dönem" className="flex rounded-lg bg-muted p-1">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          type="button"
          aria-pressed={period.value === value}
          onClick={() => onChange(period.value)}
          className={cn(
            "h-11 flex-1 rounded-md px-3.5 text-sm whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9",
            period.value === value && "border bg-background font-medium text-foreground",
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Genel bakış yükleniyor" aria-busy="true" className="space-y-4 md:space-y-6">
      <KpiGridSkeleton />
      <div className={CHARTS_CLASS}>
        <PanelSkeleton className={TREND_SPAN} />
        <PanelSkeleton />
      </div>
      <PanelSkeleton />
    </div>
  );
}

function DashboardBody({ period }: { period: SummaryPeriod }) {
  const kpis = useKpis(period);
  const trend = useTrend(period);
  const categories = useCategories(period);
  const failed = [kpis, trend, categories].find((query) => query.isError);
  if (failed?.error) {
    const retry = () => [kpis, trend, categories].forEach((query) => void query.refetch());
    return <ErrorState title="Genel bakış yüklenemedi." error={failed.error} onRetry={retry} />;
  }
  if (!kpis.data || !trend.data || !categories.data) {
    return <DashboardSkeleton />;
  }
  const isEmpty = kpis.data.total_cases.value === 0;
  return (
    <div className="space-y-4 md:space-y-6">
      <KpiGrid kpis={kpis.data} days={periodDays(period)} />
      <div className={CHARTS_CLASS}>
        <div className={TREND_SPAN}>
          <TrendChart trend={trend.data} />
        </div>
        <CategoryBars categories={categories.data} className="h-full" />
      </div>
      {isEmpty ? <AiSummaryEmpty /> : <AiSummary period={period} />}
    </div>
  );
}

// Mudur ana ekrani (docs/UI_GUIDE.md bolum 5.4; Figma: 05 Manager > /manager/dashboard)
export function Dashboard() {
  const [period, setPeriod] = useState<SummaryPeriod>("7d");
  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageTitle>Genel bakış</PageTitle>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </header>
      <DashboardBody period={period} />
    </div>
  );
}
