"use client";

import { useState } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { useCategories, useKpis, useTrend } from "@/hooks/useAnalytics";
import { periodDays, type SummaryPeriod } from "@/lib/analytics";

import { AiSummary, AiSummaryEmpty } from "./AiSummary";
import { PeriodSwitch } from "../PeriodSwitch";
import { CategoryBars } from "./CategoryBars";
import { PanelSkeleton } from "./ChartCard";
import { KpiGrid, KpiGridSkeleton } from "./KpiGrid";
import { TrendChart } from "./TrendChart";

const CHARTS_CLASS = "grid gap-4 lg:grid-cols-3";
const TREND_SPAN = "lg:col-span-2";

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
        <PageTitle>Genel Bakış</PageTitle>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </header>
      <DashboardBody period={period} />
    </div>
  );
}
