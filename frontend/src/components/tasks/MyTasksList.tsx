"use client";

import { PageTitle } from "@/components/layout/PageTitle";
import { ErrorState } from "@/components/states/ErrorState";
import { useMyTasks } from "@/hooks/useTasks";

import { TaskCard, TaskCardSkeleton } from "./TaskCard";

// Iskelet kart sayisi: ilk ekranda gorunen kart sayisi kadar (Figma: /staff/tasks - yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3", "s4"];

type MyTasksQuery = ReturnType<typeof useMyTasks>;

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">Şu an bekleyen görevin yok.</p>
      <p className="text-sm text-muted-foreground">Sana yeni bir görev atandığında burada görünür.</p>
    </div>
  );
}

function MyTasksBody({ query }: { query: MyTasksQuery }) {
  if (query.isPending) {
    return (
      <ul aria-label="Görevler yükleniyor" aria-busy="true" className="grid gap-3">
        {SKELETON_KEYS.map((key) => (
          <li key={key}>
            <TaskCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }
  if (query.isError) {
    return <ErrorState title="Görevlerin yüklenemedi." error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (query.data.items.length === 0) {
    return <EmptyState />;
  }
  return (
    <ul className="grid gap-3">
      {query.data.items.map((task) => (
        <li key={task.id}>
          <TaskCard task={task} />
        </li>
      ))}
    </ul>
  );
}

export function MyTasksList() {
  const query = useMyTasks();
  const count = query.data?.items.length ?? 0;
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4 md:space-y-6">
      <header className="space-y-2">
        <PageTitle>Görevlerim</PageTitle>
        {count > 0 ? (
          <p className="text-sm text-muted-foreground">{count} açık görev · en acil olan üstte</p>
        ) : null}
      </header>
      <MyTasksBody query={query} />
    </div>
  );
}
