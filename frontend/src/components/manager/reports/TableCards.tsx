import { formatMinutes, formatPercent } from "@/lib/analytics";
import {
  busiestDepartmentHeadline,
  formatDecimal,
  slowestCategoryHeadline,
  type DepartmentsRead,
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
