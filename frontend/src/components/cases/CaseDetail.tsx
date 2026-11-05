"use client";

import { ArrowLeft, UsersIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "cn";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCase, type CaseRead } from "@/hooks/useCases";
import { ApiError } from "@/lib/api/client";
import { reportedByText } from "@/lib/caseActions";
import { formatDateTime } from "@/lib/dates";
import { reporterView } from "@/lib/status";

import { CaseComments } from "./CaseComments";
import { CaseFeedback } from "./CaseFeedback";
import { CaseStatusView } from "./CaseStatusView";
import { CaseTimeline } from "./CaseTimeline";
import { InfoReplyForm } from "./InfoReplyForm";

const NOT_FOUND = 404;
const INFO_TITLE_ID = "reporter-case-info-title";

type CaseQuery = ReturnType<typeof useCase>;

// Bilgi satiri: solda ad, sagda deger (Figma: 08 Yeni Stil (A) > bildirim detayi)
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words">{value}</dd>
    </div>
  );
}

// Aciklama kartin ustunde duz metin, altinda konum, birim, tarih satir satir
function CaseInfo({ item }: { item: CaseRead }) {
  return (
    <section aria-labelledby={INFO_TITLE_ID} className="space-y-3 surface p-4 md:p-6">
      <h2 id={INFO_TITLE_ID} className="text-base font-semibold">
        Bildirim bilgileri
      </h2>
      <p className="text-[15px]">{item.description}</p>
      <dl className="divide-y">
        <Field label="Konum" value={item.location.name} />
        <Field label="Birim" value={item.department?.name ?? "Henüz belirlenmedi"} />
        <Field label="Bildirim tarihi" value={formatDateTime(item.created_at)} />
      </dl>
    </section>
  );
}

// Ayni sorunu baskalari da bildirdiyse (Figma: DuplicateNote); yalniz bildiren varsa satir cikmaz
function ReportedBy({ count }: { count: number }) {
  const text = reportedByText(count);
  if (text === null) {
    return null;
  }
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
      <UsersIcon aria-hidden className="size-4 shrink-0" />
      {text}
    </p>
  );
}

function CaseDetailView({ item }: { item: CaseRead }) {
  return (
    <>
      <header className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground md:text-sm">{item.case_number}</p>
          <PageTitle>{item.title}</PageTitle>
        </div>
        {/* Ek bilgi bekleyen bildirimde soru + yanit kutusu, digerlerinde ilerleme ya da bilgi notu */}
        {item.status === "NEEDS_INFO" ? (
          <InfoReplyForm item={item} />
        ) : (
          <CaseStatusView view={reporterView(item.status, item.info_request)} />
        )}
      </header>
      <ReportedBy count={item.duplicate_count} />
      <CaseFeedback item={item} />
      <CaseInfo item={item} />
      <CaseTimeline caseId={String(item.id)} />
      <CaseComments caseId={item.id} />
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
      <Link href="/my-cases" className={cn(buttonVariants({ className: "mt-2 h-11 px-4" }))}>
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
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      {/* Telefonda geri butonu ust cubukta (MobileAppBar, Tur=Geri) */}
      <Link
        href="/my-cases"
        className="hidden min-h-11 items-center gap-1.5 text-sm font-medium hover:underline md:inline-flex"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Bildirimlerim
      </Link>
      <CaseDetailBody query={query} />
    </div>
  );
}
