"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTask } from "@/hooks/useTasks";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/dates";
import { slaView, type TaskRead } from "@/lib/tasks";

import { EvidencePhotos } from "./EvidencePhotos";
import { TaskActionBar } from "./TaskActionBar";
import { PriorityBadge, SlaBadge, TaskStatusBadge } from "./TaskBadges";

const NOT_FOUND = 404;
const CARD_CLASS = "space-y-3 rounded-lg border bg-card p-4";

type TaskQuery = ReturnType<typeof useTask>;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

// Biten gorevin sonucu: tamamlandiysa zaman ve not, reddedildiyse gerekce (Figma: tamamlandi)
function TaskResult({ task }: { task: TaskRead }) {
  if (task.status === "COMPLETED") {
    return (
      <section className={CARD_CLASS}>
        <h2 className="font-semibold">Görev tamamlandı</h2>
        <dl className="space-y-3">
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
        <h2 className="font-semibold">Görev reddedildi</h2>
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
          <p className="text-xs text-muted-foreground">{task.case_number}</p>
          <PageTitle size="md">{task.location.name}</PageTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          <TaskStatusBadge status={task.status} />
          {sla ? <SlaBadge view={sla} /> : null}
        </div>
      </header>
      <TaskResult task={task} />
      <dl className={CARD_CLASS}>
        <Field label="İş">{task.title}</Field>
        <Field label="Açıklama">{task.description}</Field>
        <Field label="Birim">{task.department.name}</Field>
        {task.priority ? (
          <Field label="Öncelik">
            <PriorityBadge priority={task.priority} />
          </Field>
        ) : null}
        <Field label="Atanma">{formatDateTime(task.created_at)}</Field>
      </dl>
      <TaskActionBar task={task} />
    </>
  );
}

// Olmayan ve baskasina ait gorev ayni ekrani gorur: varlik sizdirilmaz (docs/UI_GUIDE.md bolum 7)
function NotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Kayıt bulunamadı</p>
      <p className="text-sm text-muted-foreground">Bu görev yok ya da sana atanmamış.</p>
      <Link href="/staff/tasks" className={buttonVariants({ className: "mt-2 h-11 px-4" })}>
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
