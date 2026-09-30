"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCase, type CaseRead } from "@/hooks/useCases";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/dates";
import { reporterView } from "@/lib/status";

import { CaseStatusView } from "./CaseStatusView";
import { CaseTimeline } from "./CaseTimeline";

const NOT_FOUND = 404;

type CaseQuery = ReturnType<typeof useCase>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

function CaseDetailView({ item }: { item: CaseRead }) {
  return (
    <>
      <header className="space-y-3">
        <p className="text-xs text-muted-foreground">{item.case_number}</p>
        <PageTitle>{item.title}</PageTitle>
        <CaseStatusView view={reporterView(item.status, item.info_request)} />
      </header>
      <div className="grid items-start gap-8 md:grid-cols-[1fr_20rem]">
        <dl className="space-y-4 rounded-xl border p-6">
          <Field label="Açıklama" value={item.description} />
          <Field label="Konum" value={item.location.name} />
          <Field label="Birim" value={item.department?.name ?? "Henüz belirlenmedi"} />
          <Field label="Bildirim tarihi" value={formatDateTime(item.created_at)} />
        </dl>
        <CaseTimeline caseId={String(item.id)} />
      </div>
    </>
  );
}

// Olmayan ve baskasina ait kayit ayni ekrani gorur: varlik sizdirilmaz (docs/UI_GUIDE.md bolum 7)
function NotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Kayıt bulunamadı</p>
      <p className="text-sm text-muted-foreground">
        Bu bildirim silinmiş olabilir ya da görüntüleme yetkiniz yok.
      </p>
      <Link href="/my-cases" className={buttonVariants({ className: "mt-2 h-11 px-4" })}>
        Bildirimlerime dön
      </Link>
    </div>
  );
}

function CaseDetailBody({ query }: { query: CaseQuery }) {
  if (query.isPending) {
    return (
      <div aria-label="Bildirim yükleniyor" aria-busy="true" className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (query.error instanceof ApiError && query.error.status === NOT_FOUND) {
    return <NotFound />;
  }
  if (query.isError) {
    return (
      <ErrorState title="Bildirim yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  return <CaseDetailView item={query.data} />;
}

export function CaseDetail({ caseId }: { caseId: string }) {
  const query = useCase(caseId);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/my-cases"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Bildirimlerim
      </Link>
      <CaseDetailBody query={query} />
    </div>
  );
}
