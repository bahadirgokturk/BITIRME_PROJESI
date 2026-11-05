"use client";

import Link from "next/link";
import { useState } from "react";

import { ExportButton } from "@/components/export/ExportButton";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import {
  AUDIT_PAGE_SIZE,
  fetchAllAuditLogs,
  useAuditLogs,
  useAuditNameLookup,
  type AuditQuery,
} from "@/hooks/useAuditLogs";
import { auditLogsSheet } from "@/lib/exportSheets";
import { ENTITY_LABELS, pageSummary, type AuditEntity, type AuditTarget, type NameLookup } from "@/lib/auditLogs";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader, Toolbar } from "../AdminParts";
import { AdminSections } from "../AdminSections";
import { FilterSelect } from "../SearchFilters";
import { AuditLogTable } from "./AuditLogTable";

type LogsQuery = ReturnType<typeof useAuditLogs>;

const ALL = "";
// Bu ekranda arama kutusu yok; oneri yalniz tur suzgecinden soz eder
const KIND_HINT = "Farklı bir kayıt türü seçin ya da filtreleri temizleyin.";
const AUDIT_PATH = "/admin/audit-logs";
const DESCRIPTION = "Yönetim ekranlarında yapılan her değişiklik: kim, ne zaman, neyi değiştirdi.";

function EmptyNote({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

interface PagerProps {
  page: number;
  total: number;
  onPage: (page: number) => void;
}

// "1-50 / 312 kayit" + onceki/sonraki; tek sayfaya sigiyorsa dugmeler cizilmez
function Pager({ page, total, onPage }: PagerProps) {
  const lastPage = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  return (
    <div className="flex items-center gap-2">
      <p className="mr-auto text-sm text-muted-foreground md:mr-2">{pageSummary({ page, pageSize: AUDIT_PAGE_SIZE, total })}</p>
      {lastPage > 1 ? (
        <>
          <Button variant="outline" className="h-11 px-4 md:h-9" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Önceki
          </Button>
          <Button
            variant="outline"
            className="h-11 px-4 md:h-9"
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

interface BodyProps {
  query: LogsQuery;
  lookup: NameLookup;
  page: number;
  // Suzgec varken bos liste "uyan kayit yok" demektir; yokken "henuz kayit yok"
  filtered: boolean;
  onPage: (page: number) => void;
  onClear: (() => void) | null;
}

function emptyState(filtered: boolean, onClear: (() => void) | null) {
  if (onClear) {
    return <NoMatch title="Bu filtreye uyan kayıt yok." hint={KIND_HINT} onClear={onClear} />;
  }
  return filtered ? (
    <EmptyNote title="Bu kaydın geçmişi yok." note="Kayıt, işlem kayıtları tutulmaya başlamadan önce eklenmiş olabilir." />
  ) : (
    <EmptyNote title="Henüz işlem kaydı yok." note="Yönetim ekranlarında yapılan ekleme ve değişiklikler burada görünür." />
  );
}

function AuditLogsBody({ query, lookup, page, filtered, onPage, onClear }: BodyProps) {
  if (query.isPending) {
    return <ListSkeleton label="İşlem kayıtları yükleniyor" />;
  }
  if (query.isError) {
    return <ErrorState title="İşlem kayıtları yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.data.total === 0) {
    return emptyState(filtered, onClear);
  }
  return (
    <AuditLogTable
      logs={query.data.items}
      lookup={lookup}
      footer={<Pager page={page} total={query.data.total} onPage={onPage} />}
    />
  );
}

function KindFilter({ value, onChange }: { value: AuditEntity | null; onChange: (kind: AuditEntity | null) => void }) {
  return (
    <FilterSelect
      aria-label="Kayıt türü"
      value={value ?? ALL}
      onChange={(event) => onChange((event.target.value || null) as AuditEntity | null)}
      className="w-full md:w-64"
    >
      <option value={ALL}>Tüm kayıt türleri</option>
      {Object.entries(ENTITY_LABELS).map(([kind, label]) => (
        <option key={kind} value={kind}>
          {label}
        </option>
      ))}
    </FilterSelect>
  );
}

// Baska bir sekmedeki "Gecmisi gor" baglantisiyla gelindiginde: hangi kaydin gecmisi + butun kayitlara donus
function HistoryBar({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5 text-sm md:flex-row md:items-center md:justify-between">
      <p className="font-medium">{name} kaydının geçmişi</p>
      <Link href={AUDIT_PATH} className="font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
        Tüm kayıtları göster
      </Link>
    </div>
  );
}

// Adresteki tek kayit suzgeci varsa o, yoksa secili kayit turu
function auditFilter(target: AuditTarget | null, kind: AuditEntity | null): Omit<AuditQuery, "page"> {
  return target ? { entityType: target.entityType, entityId: target.entityId } : { entityType: kind, entityId: null };
}

interface AuditExportProps {
  query: Omit<AuditQuery, "page">;
  lookup: NameLookup;
  disabled: boolean;
}

// Ekranda 50'lik sayfa gorunur; dosyaya ayni suzgecle butun kayitlar yazilir
function AuditExport({ query, lookup, disabled }: AuditExportProps) {
  return (
    <ExportButton
      fileName="islem-kayitlari"
      disabled={disabled}
      load={async () => auditLogsSheet(await fetchAllAuditLogs(query), lookup)}
    />
  );
}

// Yonetim > Islem Kayitlari (docs/UI_GUIDE.md bolum 5.5). target: adresteki tek kayit suzgeci (yoksa null)
export function AuditLogsScreen({ target }: { target: AuditTarget | null }) {
  const [kind, setKind] = useState<AuditEntity | null>(null);
  const [page, setPage] = useState(1);
  const lookup = useAuditNameLookup();
  const filter = auditFilter(target, kind);
  const logs = useAuditLogs({ ...filter, page });

  function chooseKind(next: AuditEntity | null) {
    setKind(next);
    setPage(1);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active={AUDIT_PATH} />
      <ScreenHeader title="İşlem Kayıtları" description={DESCRIPTION} />
      <ActionNote message={null} />
      <Toolbar action={<AuditExport query={filter} lookup={lookup} disabled={!logs.data?.total} />}>
        {target ? (
          <HistoryBar name={lookup(target.entityType, target.entityId) ?? `#${target.entityId}`} />
        ) : (
          <KindFilter value={kind} onChange={chooseKind} />
        )}
      </Toolbar>
      <AuditLogsBody
        query={logs}
        lookup={lookup}
        page={page}
        filtered={target !== null}
        onPage={setPage}
        onClear={kind ? () => chooseKind(null) : null}
      />
    </div>
  );
}
