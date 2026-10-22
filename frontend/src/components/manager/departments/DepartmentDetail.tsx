"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useDepartments, useKpis, useRecurring, useTrend } from "@/hooks/useAnalytics";
import { periodDays, type SummaryPeriod } from "@/lib/analytics";
import { DEPARTMENTS_PATH, departmentStaff, departmentStats } from "@/lib/departments";
import type { DepartmentPerformance } from "@/lib/reports";

import { CategoryBars } from "../dashboard/CategoryBars";
import { PanelSkeleton } from "../dashboard/ChartCard";
import { KpiGrid, KpiGridSkeleton } from "../dashboard/KpiGrid";
import { TrendChart } from "../dashboard/TrendChart";
import { PeriodSwitch } from "../PeriodSwitch";
import { RecurringCard } from "../reports/RecurringCard";
import { CARD_CLASS, StatGrid } from "./DepartmentCard";

const CHARTS_CLASS = "grid gap-4 lg:grid-cols-3";

// Listedeki kartla ayni sayilar; masaustunde dort sayi tek satirda
function UnitSummary({ item }: { item: DepartmentPerformance }) {
  return (
    <section role="group" aria-label="Birim özeti" className={`${CARD_CLASS} space-y-3`}>
      <h2 className="font-semibold">Birim özeti</h2>
      <div className="md:[&_dl]:grid-cols-4">
        <StatGrid stats={departmentStats(item)} />
      </div>
      <p className="text-xs text-muted-foreground">{departmentStaff(item)}</p>
    </section>
  );
}

// Genel Bakis ve Raporlar'in parcalari, yalniz bu birim icin (department_id)
function UnitAnalytics({ period, departmentId }: { period: SummaryPeriod; departmentId: number }) {
  const kpis = useKpis(period, departmentId);
  const trend = useTrend(period, departmentId);
  const categories = useCategories(period, departmentId);
  const recurring = useRecurring(period, departmentId);
  const queries = [kpis, trend, categories, recurring];
  const failed = queries.find((query) => query.isError);
  if (failed?.error) {
    const retry = () => queries.forEach((query) => void query.refetch());
    return <ErrorState title="Birimin göstergeleri yüklenemedi." error={failed.error} onRetry={retry} />;
  }
  if (!kpis.data || !trend.data || !categories.data || !recurring.data) {
    return <KpiGridSkeleton />;
  }
  return (
    <div className="space-y-4 md:space-y-6">
      <KpiGrid kpis={kpis.data} days={periodDays(period)} />
      <div className={CHARTS_CLASS}>
        <div className="lg:col-span-2">
          <TrendChart trend={trend.data} />
        </div>
        <CategoryBars categories={categories.data} className="h-full" />
      </div>
      <RecurringCard recurring={recurring.data} />
    </div>
  );
}

// Listede olmayan ya da yetki disi birim ayni ekrani gorur (docs/UI_GUIDE.md bolum 7)
function NotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Birim bulunamadı</p>
      <p className="text-sm text-muted-foreground">Bu birim kaldırılmış olabilir ya da görüntüleme yetkiniz yok.</p>
      <Link href={DEPARTMENTS_PATH} className={buttonVariants({ className: "mt-2 h-11 px-4" })}>
        Birim Performansı&apos;na dön
      </Link>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-label="Birim yükleniyor" aria-busy="true" className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <PanelSkeleton />
    </div>
  );
}

interface DepartmentDetailProps {
  departmentId: string;
  initialPeriod: SummaryPeriod;
}

// Bir birimin ayrintili performansi (Figma: 05 Manager > /manager/departments/[id])
export function DepartmentDetail({ departmentId, initialPeriod }: DepartmentDetailProps) {
  const [period, setPeriod] = useState<SummaryPeriod>(initialPeriod);
  const departments = useDepartments(period);
  const id = Number(departmentId);
  const item = departments.data?.items.find((entry) => entry.department.id === id);
  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      {/* Telefonda geri butonu ust cubukta (MobileAppBar, Tur=Geri) */}
      <Link href={DEPARTMENTS_PATH} className="hidden min-h-11 items-center gap-1.5 text-sm font-medium hover:underline md:inline-flex">
        <ArrowLeft aria-hidden className="size-4" />
        Birim Performansı
      </Link>
      <DetailBody query={departments} item={item} period={period} onPeriod={setPeriod} />
    </div>
  );
}

interface DetailBodyProps {
  query: ReturnType<typeof useDepartments>;
  item: DepartmentPerformance | undefined;
  period: SummaryPeriod;
  onPeriod: (period: SummaryPeriod) => void;
}

function DetailBody({ query, item, period, onPeriod }: DetailBodyProps) {
  if (query.isPending) {
    return <DetailSkeleton />;
  }
  if (query.isError) {
    return <ErrorState title="Birim yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!item) {
    return <NotFound />;
  }
  return (
    <>
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageTitle>{item.department.name}</PageTitle>
        <PeriodSwitch value={period} onChange={onPeriod} />
      </header>
      <UnitSummary item={item} />
      <UnitAnalytics period={period} departmentId={item.department.id} />
    </>
  );
}
