"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "cn";

import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { AUDIT_PAGE_SIZE, useAuditLogs, useAuditNameLookup } from "@/hooks/useAuditLogs";
import { ENTITY_LABELS, pageSummary, type AuditEntity, type AuditTarget, type NameLookup } from "@/lib/auditLogs";

import { ActionNote, ListSkeleton, NoMatch, ScreenHeader } from "../AdminParts";
import { AdminSections } from "../AdminSections";
import { FILTER_FIELD_CLASS } from "../SearchFilters";
import { AuditLogTable } from "./AuditLogTable";

type LogsQuery = ReturnType<typeof useAuditLogs>;

const ALL = "";
const AUDIT_PATH = "/admin/audit-logs";

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
          <Button variant="outline" className="h-11 px-4" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Önceki
          </Button>
          <Button variant="outline" className="h-11 px-4" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
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
    return <NoMatch title="Bu süzgece uyan kayıt yok." onClear={onClear} />;
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
    <div className="space-y-3">
      <AuditLogTable logs={query.data.items} lookup={lookup} />
      <Pager page={page} total={query.data.total} onPage={onPage} />
    </div>
  );
}

function KindFilter({ value, onChange }: { value: AuditEntity | null; onChange: (kind: AuditEntity | null) => void }) {
  return (
    <select
      aria-label="Kayıt türü"
      value={value ?? ALL}
      onChange={(event) => onChange((event.target.value || null) as AuditEntity | null)}
      className={cn(FILTER_FIELD_CLASS, "w-full md:w-64")}
    >
      <option value={ALL}>Tüm kayıt türleri</option>
      {Object.entries(ENTITY_LABELS).map(([kind, label]) => (
        <option key={kind} value={kind}>
          {label}
        </option>
      ))}
    </select>
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

// Yonetim > Islem Kayitlari (docs/UI_GUIDE.md bolum 5.5). target: adresteki tek kayit suzgeci (yoksa null)
export function AuditLogsScreen({ target }: { target: AuditTarget | null }) {
  const [kind, setKind] = useState<AuditEntity | null>(null);
  const [page, setPage] = useState(1);
  const lookup = useAuditNameLookup();
  const logs = useAuditLogs({ entityType: target?.entityType ?? kind, entityId: target?.entityId ?? null, page });

  function chooseKind(next: AuditEntity | null) {
    setKind(next);
    setPage(1);
  }

  return (
    <div className="mx-auto w-full max-w-[1152px] space-y-4 md:space-y-6">
      <AdminSections active={AUDIT_PATH} />
      <ScreenHeader title="İşlem Kayıtları" />
      <ActionNote message={null} />
      {target ? (
        <HistoryBar name={lookup(target.entityType, target.entityId) ?? `#${target.entityId}`} />
      ) : (
        <KindFilter value={kind} onChange={chooseKind} />
      )}
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
