"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "cn";

import { PageTitle } from "@/components/layout/PageTitle";
import { CaseComments } from "@/components/cases/CaseComments";
import { ErrorState } from "@/components/states/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTask } from "@/hooks/useTasks";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/dates";
import { canAddWorkPhoto, isOverdue, showsTaskTitle, slaView, type TaskRead } from "@/lib/tasks";

import { EvidencePhotos } from "./EvidencePhotos";
import { EvidenceRequestNote } from "./EvidenceRequestNote";
import { TaskActionBar } from "./TaskActionBar";
import { PriorityBadge, SlaBadge, TaskStatusBadge } from "./TaskBadges";
import { WorkPhotoButton } from "./WorkPhotoButton";

const NOT_FOUND = 404;
const CARD_CLASS = "space-y-3 surface p-4 md:p-6";

type TaskQuery = ReturnType<typeof useTask>;

// Bilgi satiri: solda ad, sagda deger (Figma: 08 Yeni Stil (A) > gorev detayi, Is karti)
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

// Suresi gecen acik iste ne yapilacagi (Figma: 08 Yeni Stil (A) > gorev detayi)
function OverdueNote() {
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
      <span className="font-semibold">Hedef süre geçti.</span> İşi bitirdiysen &quot;Tamamla&quot;ya bas; bitmediyse
      yorumla durumu yaz.
    </p>
  );
}

// Is karti: ne yapilacak (aciklama), sonra bilgiler satir satir; is surerken fotograf eklenir
function JobCard({ task }: { task: TaskRead }) {
  return (
    <section aria-label="İş" className={`${CARD_CLASS} space-y-4`}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{showsTaskTitle(task) ? task.title : "İş"}</h2>
        <p className="text-[15px]">{task.description}</p>
      </div>
      <dl className="divide-y">
        <Field label="Birim">{task.department.name}</Field>
        {task.priority ? (
          <Field label="Öncelik">
            <PriorityBadge priority={task.priority} />
          </Field>
        ) : null}
        <Field label="Atanma">{formatDateTime(task.created_at)}</Field>
      </dl>
      {canAddWorkPhoto(task.status) ? (
        <>
          <EvidencePhotos caseId={task.case_id} />
          <WorkPhotoButton caseId={task.case_id} />
        </>
      ) : null}
    </section>
  );
}

// Biten gorevin sonucu: tamamlandiysa zaman ve not, reddedildiyse gerekce (Figma: tamamlandi)
function TaskResult({ task }: { task: TaskRead }) {
  if (task.status === "COMPLETED") {
    return (
      <section className={CARD_CLASS}>
        <h2 className="text-base font-semibold">Görev tamamlandı</h2>
        <dl className="divide-y">
          {task.completed_at ? <Field label="Tamamlanma">{formatDateTime(task.completed_at)}</Field> : null}
          {task.completion_note ? <Field label="Not">{task.completion_note}</Field> : null}
        </dl>
        <EvidencePhotos caseId={task.case_id} />
      </section>
    );
  }
  if (task.status === "DECLINED") {
    return (
      <section className={CARD_CLASS}>
        <h2 className="text-base font-semibold">Görev reddedildi</h2>
        <dl>{task.declined_reason ? <Field label="Neden">{task.declined_reason}</Field> : null}</dl>
      </section>
    );
  }
  return null;
}

function TaskDetailView({ task }: { task: TaskRead }) {
  const sla = slaView(task);
  return (
    <>
      <header className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground md:text-sm">{task.case_number}</p>
          <PageTitle>{task.location.name}</PageTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          <TaskStatusBadge status={task.status} />
          {sla ? <SlaBadge view={sla} /> : null}
        </div>
      </header>
      {isOverdue(task) ? <OverdueNote /> : null}
      {task.status === "IN_PROGRESS" ? <EvidenceRequestNote task={task} /> : null}
      <TaskResult task={task} />
      <JobCard task={task} />
      {/* Ana dugmeler yorumlarin ustunde: gorevli kaydirmadan gorur (Figma: 04 Staff > yorumlar) */}
      <TaskActionBar task={task} />
      {/* Bildirenle yazisma ve ekip ici notlar (ic not bildirene gorunmez) */}
      <CaseComments caseId={task.case_id} />
    </>
  );
}

// Olmayan ve baskasina ait gorev ayni ekrani gorur: varlik sizdirilmaz (docs/UI_GUIDE.md bolum 7)
function NotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Kayıt bulunamadı</p>
      <p className="text-sm text-muted-foreground">Bu görev yok ya da sana atanmamış.</p>
      <Link href="/staff/tasks" className={cn(buttonVariants({ className: "mt-2 h-11 px-4" }))}>
        Görevlerime dön
      </Link>
    </div>
  );
}

function TaskDetailBody({ query }: { query: TaskQuery }) {
  if (query.isPending) {
    return (
      <div aria-label="Görev yükleniyor" aria-busy="true" className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (query.error instanceof ApiError && query.error.status === NOT_FOUND) {
    return <NotFound />;
  }
  if (query.isError) {
    return <ErrorState title="Görev yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <TaskDetailView task={query.data} />;
}

export function TaskDetail({ taskId }: { taskId: string }) {
  const query = useTask(taskId);
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      {/* Telefonda geri butonu ust cubukta (MobileAppBar, Tur=Geri) */}
      <Link
        href="/staff/tasks"
        className="hidden min-h-11 items-center gap-1.5 text-sm font-medium hover:underline md:inline-flex"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Görevlerim
      </Link>
      <TaskDetailBody query={query} />
    </div>
  );
}
