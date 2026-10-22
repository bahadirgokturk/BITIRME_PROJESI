"use client";

import { useState } from "react";

import { CheckboxFilter } from "@/components/filters/CheckboxFilter";
import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { useDepartments } from "@/hooks/useAnalytics";
import type { SummaryPeriod } from "@/lib/analytics";
import {
  departmentCards,
  departmentFilterSummary,
  departmentOptions,
  departmentPath,
  shownDepartments,
} from "@/lib/departments";
import type { DepartmentsRead } from "@/lib/reports";

import { PanelSkeleton } from "../dashboard/ChartCard";
import { PeriodSwitch } from "../PeriodSwitch";
import { DepartmentCard } from "./DepartmentCard";

const GRID_CLASS = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
const SKELETON_KEYS = ["d1", "d2", "d3"];

interface DepartmentListProps {
  report: DepartmentsRead;
  period: SummaryPeriod;
}

function DepartmentList({ report, period }: DepartmentListProps) {
  // Secim birim kimlikleriyle tutulur (filtre bileseni metin deger kullanir)
  const [selected, setSelected] = useState<string[]>([]);
  const options = departmentOptions(report.items);
  const cards = departmentCards(report.items, selected.map(Number));
  if (report.items.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Henüz birim yok.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <CheckboxFilter
          label="Birimler"
          summary={departmentFilterSummary(selected, options)}
          options={options}
          selected={selected}
          onChange={setSelected}
        />
        <p className="text-sm text-muted-foreground">{shownDepartments(cards.length, report.items.length)}</p>
      </div>
      <ul aria-label="Birimler" className={GRID_CLASS}>
        {cards.map((card) => (
          <li key={card.id}>
            <DepartmentCard name={card.name} stats={card.stats} staff={card.staff} href={departmentPath(card.id, period)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DepartmentBody({ period }: { period: SummaryPeriod }) {
  const query = useDepartments(period);
  if (query.isPending) {
    return (
      <div aria-label="Birimler yükleniyor" aria-busy="true" className={GRID_CLASS}>
        {SKELETON_KEYS.map((key) => (
          <PanelSkeleton key={key} />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState title="Birim performansı yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <DepartmentList report={query.data} period={period} />;
}

// Mudur ve yonetici: her birim bir kart, tikli birim filtresi, karta tiklayinca birimin detayi
// (docs/UI_GUIDE.md bolum 5.4; Figma: 05 Manager > /manager/departments)
export function DepartmentPerformance() {
  const [period, setPeriod] = useState<SummaryPeriod>("7d");
  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <header className="space-y-2">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <PageTitle>Birim Performansı</PageTitle>
          <PeriodSwitch value={period} onChange={setPeriod} />
        </div>
        <p className="text-sm text-muted-foreground">
          Her birimin bu dönemdeki bildirim, süre ve iş yükü durumu. Ayrıntılar için birime tıklayın.
        </p>
      </header>
      <DepartmentBody period={period} />
    </div>
  );
}
