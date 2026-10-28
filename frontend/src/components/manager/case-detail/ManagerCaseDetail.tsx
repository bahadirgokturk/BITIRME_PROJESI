"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "cn";

import { CaseComments } from "@/components/cases/CaseComments";
import { ErrorState } from "@/components/states/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCase, type CaseRead } from "@/hooks/useCases";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ApiError } from "@/lib/api/client";
import { CASE_LIST_VIEWS, type CaseListView } from "@/lib/caseList";
import { awaitsManager, caseDetailSections } from "@/lib/managerCase";

import { DecisionPanel } from "../DecisionPanel";
import { CaseDecision } from "./CaseDecision";
import { CasePhotos } from "./CasePhotos";
import { CaseHeader, CaseInfo } from "./CaseSummary";
import { ManagerTimeline } from "./ManagerTimeline";

const NOT_FOUND = 404;

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
  // Karardan sonra karar kutusu kaybolur; onay notu burada kalir
  const [lastAction, setLastAction] = useState<string | null>(null);
  // Rol bilinene kadar yetki gerektiren bolumler acilmaz (gereksiz 403 istegi atilmaz)
  const sections = caseDetailSections(useCurrentUser().data?.role);
  return (
    <>
      <CaseHeader item={item} />
      <p role="status" className={lastAction ? "rounded-md bg-muted px-3 py-2 text-sm" : "sr-only"}>
        {lastAction}
      </p>
      {sections.decide && awaitsManager(item) ? <CaseDecision item={item} onDone={setLastAction} /> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4 xl:order-2">
          <CaseInfo item={item} showRisk={sections.delayRisk} />
          <CasePhotos caseId={item.id} />
        </div>
        <div className="space-y-6">
          {sections.aiDecisions ? <AiDecisions caseId={item.id} /> : null}
          <ManagerTimeline caseId={String(item.id)} />
          <CaseComments caseId={item.id} />
        </div>
      </div>
    </>
  );
}

// Olmayan ve yetki disi kayit ayni ekrani gorur: varlik sizdirilmaz (docs/UI_GUIDE.md bolum 7)
function NotFound({ view }: { view: CaseListView }) {
  const { path, backText } = CASE_LIST_VIEWS[view];
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Kayıt bulunamadı</p>
      <p className="text-sm text-muted-foreground">Bu bildirim silinmiş olabilir ya da görüntüleme yetkiniz yok.</p>
      <Link href={path} className={cn(buttonVariants({ className: "mt-2 h-11 px-4" }))}>
        {backText}
      </Link>
    </div>
  );
}

function CaseBody({ query, view }: { query: CaseQuery; view: CaseListView }) {
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
    return <NotFound view={view} />;
  }
  if (query.isError) {
    return <ErrorState title="Bildirim yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <CaseView item={query.data} />;
}

// Bildirim detayi (mudur, yonetici, personel): bilgiler, zaman cizelgesi, fotograflar, yorumlar; rolun
// izni varsa yapay zeka kararlari ve inceleme bekleyen bildirimde karar dugmeleri (kuyruktakiyle ayni).
// view: hangi listeden gelindi (geri baglantisi ona doner)
export function ManagerCaseDetail({ caseId, view = "all" }: { caseId: string; view?: CaseListView }) {
  const query = useCase(caseId);
  const { title, path } = CASE_LIST_VIEWS[view];
  return (
    <div className="space-y-4">
      {/* Telefonda geri butonu ust cubukta (MobileAppBar, Tur=Geri) */}
      <Link
        href={path}
        className="hidden min-h-11 items-center gap-1.5 text-sm font-medium hover:underline md:inline-flex"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {title}
      </Link>
      <CaseBody query={query} view={view} />
    </div>
  );
}
