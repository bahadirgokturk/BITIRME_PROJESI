"use client";

import { useState } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import {
  useAging,
  useDepartments,
  useLocations,
  useProcess,
  useRecurring,
  useResolutionTimes,
  useSla,
} from "@/hooks/useAnalytics";
import type { SummaryPeriod } from "@/lib/analytics";

import { PanelSkeleton } from "../dashboard/ChartCard";
import { PeriodSwitch } from "../PeriodSwitch";
import { AgingCard, LocationsCard, ProcessCard, SlaCard } from "./BarCards";
import { RecurringCard } from "./RecurringCard";
import { DepartmentsCard, ResolutionCard } from "./TableCards";

// Genis kart solda (2/3), dar kart sagda (1/3); telefonda alt alta
const ROW_CLASS = "grid gap-4 lg:grid-cols-3";
const WIDE = "lg:col-span-2";
const STACK_CLASS = "space-y-4 md:space-y-6";

function ReportsSkeleton() {
  return (
    <div aria-label="Raporlar yükleniyor" aria-busy="true" className={STACK_CLASS}>
      <div className={ROW_CLASS}>
        <PanelSkeleton className={WIDE} />
        <PanelSkeleton />
      </div>
      <div className={ROW_CLASS}>
        <PanelSkeleton className={WIDE} />
        <PanelSkeleton />
      </div>
      <PanelSkeleton />
    </div>
  );
}

// Sorgularin hepsi geldiyse verileri, biri bile eksikse null doner
function loaded<T extends Record<string, { data: unknown }>>(queries: T) {
  const entries = Object.entries(queries);
  if (entries.some(([, query]) => query.data === undefined)) {
    return null;
  }
  return Object.fromEntries(entries.map(([name, query]) => [name, query.data])) as {
    [K in keyof T]: NonNullable<T[K]["data"]>;
  };
}

function useReports(period: SummaryPeriod) {
  const queries = {
    locations: useLocations(period),
    sla: useSla(period),
    times: useResolutionTimes(period),
    aging: useAging(period),
    departments: useDepartments(period),
    recurring: useRecurring(period),
    process: useProcess(period),
  };
  const all = Object.values(queries);
  return {
    data: loaded(queries),
    error: all.find((query) => query.isError)?.error ?? null,
    retry: () => all.filter((query) => query.isError).forEach((query) => void query.refetch()),
  };
}

function ReportsBody({ period }: { period: SummaryPeriod }) {
  const { data, error, retry } = useReports(period);
  if (error) {
    return <ErrorState title="Raporlar yüklenemedi." error={error} onRetry={retry} />;
  }
  if (!data) {
    return <ReportsSkeleton />;
  }
  return (
    <div className={STACK_CLASS}>
      <div className={ROW_CLASS}>
        <div className={WIDE}>
          <LocationsCard locations={data.locations} />
        </div>
        <SlaCard sla={data.sla} />
      </div>
      <div className={ROW_CLASS}>
        <div className={WIDE}>
          <ResolutionCard times={data.times} />
        </div>
        <AgingCard aging={data.aging} />
      </div>
      <DepartmentsCard departments={data.departments} />
      <div className={ROW_CLASS}>
        <div className={WIDE}>
          <RecurringCard recurring={data.recurring} />
        </div>
        <ProcessCard process={data.process} />
      </div>
    </div>
  );
}

// Mudur rapor ekrani (docs/UI_GUIDE.md bolum 5.4; Figma: 05 Manager > /manager/analytics)
export function Reports() {
  const [period, setPeriod] = useState<SummaryPeriod>("7d");
  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageTitle>Raporlar</PageTitle>
        <PeriodSwitch value={period} onChange={setPeriod} />
      </header>
      <ReportsBody period={period} />
    </div>
  );
}
