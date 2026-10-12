"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/states/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCase, type CaseRead } from "@/hooks/useCases";
import { ApiError } from "@/lib/api/client";
import { awaitsManager } from "@/lib/managerCase";

import { DecisionPanel } from "../DecisionPanel";
import { CasePhotos } from "./CasePhotos";
import { CaseHeader, CaseInfo, ReviewNotice } from "./CaseSummary";
import { ManagerTimeline } from "./ManagerTimeline";

const NOT_FOUND = 404;
const LIST_PATH = "/manager/cases";

type CaseQuery = ReturnType<typeof useCase>;

function AiDecisions({ caseId }: { caseId: number }) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="font-semibold">Yapay zekâ kararları</h2>
        <p className="text-sm text-muted-foreground">
          Bildirim açılınca yapay zekânın attığı adımlar ve her birinin gerekçesi.
        </p>
      </div>
      <DecisionPanel caseId={caseId} />
    </section>
  );
}

// Genis ekranda iki sutun: solda kararlar ve zaman cizelgesi, sagda bilgiler ve fotograflar.
// Dar ekranda once bilgiler gelir (Figma: 05 Manager > /manager/cases/[id])
function CaseView({ item }: { item: CaseRead }) {
  return (
    <>
      <CaseHeader item={item} />
      {awaitsManager(item) ? <ReviewNotice /> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4 xl:order-2">
          <CaseInfo item={item} />
          <CasePhotos caseId={item.id} />
        </div>
        <div className="space-y-6">
          <AiDecisions caseId={item.id} />
          <ManagerTimeline caseId={String(item.id)} />
        </div>
      </div>
    </>
  );
}

// Olmayan ve yetki disi kayit ayni ekrani gorur: varlik sizdirilmaz (docs/UI_GUIDE.md bolum 7)
function NotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Kayıt bulunamadı</p>
      <p className="text-sm text-muted-foreground">Bu bildirim silinmiş olabilir ya da görüntüleme yetkiniz yok.</p>
      <Link href={LIST_PATH} className={buttonVariants({ className: "mt-2 h-11 px-4" })}>
        Tüm Bildirimler&apos;e dön
      </Link>
    </div>
  );
}

function CaseBody({ query }: { query: CaseQuery }) {
  if (query.isPending) {
    return (
      <div aria-label="Bildirim yükleniyor" aria-busy="true" className="space-y-4">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (query.error instanceof ApiError && query.error.status === NOT_FOUND) {
    return <NotFound />;
  }
  if (query.isError) {
    return <ErrorState title="Bildirim yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <CaseView item={query.data} />;
}

// Mudurun bildirim detayi: bilgiler, yapay zeka kararlari, zaman cizelgesi, fotograflar (yalniz okunur)
export function ManagerCaseDetail({ caseId }: { caseId: string }) {
  const query = useCase(caseId);
  return (
    <div className="space-y-4">
      {/* Telefonda geri butonu ust cubukta (MobileAppBar, Tur=Geri) */}
      <Link
        href={LIST_PATH}
        className="hidden min-h-11 items-center gap-1.5 text-sm font-medium hover:underline md:inline-flex"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Tüm Bildirimler
      </Link>
      <CaseBody query={query} />
    </div>
  );
}
