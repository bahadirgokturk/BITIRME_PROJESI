import { cn } from "cn";

import { formatMinutes, formatPercent, type DeltaTone } from "@/lib/analytics";
import {
  busiestDepartmentHeadline,
  formatDecimal,
  recurringHeadline,
  recurringSubtitle,
  recurringTrend,
  slowestCategoryHeadline,
  type DepartmentsRead,
  type RecurringProblem,
  type RecurringRead,
  type ResolutionTimesRead,
} from "@/lib/reports";

import { ChartCard } from "../dashboard/ChartCard";
import { StatTable } from "../StatTable";

const NOTE_CLASS = "text-xs text-muted-foreground";
const EMPTY_CLASS = "text-sm text-muted-foreground";

// Istatistik terimleri yerine duz Turkce: medyan = tipik sure, p90 = 10 isten 9'u (UI_GUIDE bolum 6)
const TIME_COLUMNS = ["Çözülen", "Ortalama", "Tipik süre", "10 işten 9'u"];
const TIME_NOTE = "Tipik süre: işlerin yarısı bu sürede biter. 10 işten 9'u: işlerin neredeyse hepsinin bittiği süre.";

export function ResolutionCard({ times }: { times: ResolutionTimesRead }) {
  const subtitle = "Kategoriye göre çözüm süresi";
  const rows = times.items.map((row) => ({
    key: row.category,
    name: row.label,
    cells: [String(row.count), formatMinutes(row.avg_min), formatMinutes(row.median_min), formatMinutes(row.p90_min)],
  }));
  return (
    <ChartCard title={slowestCategoryHeadline(times.items)} subtitle={subtitle} className="h-full">
      {rows.length === 0 ? (
        <p className={EMPTY_CLASS}>Bu dönemde çözülen bildirim yok.</p>
      ) : (
        <>
          <StatTable label={subtitle} nameHeader="Kategori" columns={TIME_COLUMNS} rows={rows} />
          <p className={NOTE_CLASS}>{TIME_NOTE}</p>
        </>
      )}
    </ChartCard>
  );
}

const DEPARTMENT_COLUMNS = ["Bildirim", "Ortalama çözüm", "Tipik çözüm", "SLA uyumu", "Açık görev", "Personel", "Kişi başı açık görev"];

export function DepartmentsCard({ departments }: { departments: DepartmentsRead }) {
  const subtitle = "Birimlere göre performans ve iş yükü";
  const rows = departments.items.map((item) => ({
    key: item.department.id,
    name: item.department.name,
    cells: [
      String(item.cases),
      formatMinutes(item.avg_resolution_min),
      formatMinutes(item.median_resolution_min),
      formatPercent(item.sla_compliance_pct),
      String(item.open_tasks),
      String(item.active_staff),
      formatDecimal(item.open_tasks_per_staff),
    ],
  }));
  return (
    <ChartCard title={busiestDepartmentHeadline(departments.items)} subtitle={subtitle}>
      {rows.length === 0 ? (
        <p className={EMPTY_CLASS}>Bu dönemde birimlere atanan bildirim yok.</p>
      ) : (
        <StatTable label={subtitle} nameHeader="Birim" columns={DEPARTMENT_COLUMNS} rows={rows} />
      )}
    </ChartCard>
  );
}

// Artan sorun kirmizi, azalan yesil; yon okla ve kelimeyle de yazilir (UI_GUIDE bolum 8)
const TONE_CLASS: Record<DeltaTone, string> = {
  good: "text-success",
  bad: "text-destructive",
  none: "text-muted-foreground",
};

function RecurringItem({ problem }: { problem: RecurringProblem }) {
  const trend = recurringTrend(problem.trend);
  return (
    <li className="space-y-1 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="font-medium">{problem.case_type.name}</span>
        <span className="shrink-0 font-semibold">{problem.count} kez</span>
      </div>
      <p className="text-xs">{problem.location.path}</p>
      <p className={cn("text-xs font-medium", TONE_CLASS[trend.tone])}>{trend.text}</p>
      <p className={NOTE_CLASS}>{problem.suggestion}</p>
    </li>
  );
}

export function RecurringCard({ recurring }: { recurring: RecurringRead }) {
  const subtitle = recurringSubtitle(recurring);
  return (
    <ChartCard title={recurringHeadline(recurring.items.length)} subtitle={subtitle} className="h-full">
      {recurring.items.length === 0 ? (
        <p className={EMPTY_CLASS}>Aynı yerde tekrar tekrar bildirilen bir sorun görülmedi.</p>
      ) : (
        <ul aria-label={subtitle} className="divide-y">
          {recurring.items.map((problem) => (
            <RecurringItem key={`${problem.location.id}-${problem.case_type.id}`} problem={problem} />
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
