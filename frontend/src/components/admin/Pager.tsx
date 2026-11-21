import { Button } from "@/components/ui/button";
import { pageSummary } from "@/lib/auditLogs";

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  // Sayilan sey (ornek: kayit, kullanici)
  unit?: string;
  onPage: (page: number) => void;
}

const PAGE_BUTTON_CLASS = "h-11 px-4 md:h-9";

// Tablonun alti: "1-50 / 312 kayit" + onceki/sonraki; tek sayfaya sigiyorsa dugmeler cizilmez
export function Pager({ page, pageSize, total, unit, onPage }: PagerProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center gap-2">
      <p className="mr-auto text-sm text-muted-foreground md:mr-2">{pageSummary({ page, pageSize, total, unit })}</p>
      {lastPage > 1 ? (
        <>
          <Button variant="outline" className={PAGE_BUTTON_CLASS} disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Önceki
          </Button>
          <Button
            variant="outline"
            className={PAGE_BUTTON_CLASS}
            disabled={page >= lastPage}
            onClick={() => onPage(page + 1)}
          >
            Sonraki
          </Button>
        </>
      ) : null}
    </div>
  );
}
