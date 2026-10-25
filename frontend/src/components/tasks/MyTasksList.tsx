"use client";

import { useState } from "react";

import { PageTitle } from "@/components/layout/PageTitle";
import { ListToolbar } from "@/components/lists/ListToolbar";
import { ErrorState } from "@/components/states/ErrorState";
import { Button } from "@/components/ui/button";
import { useListView } from "@/hooks/useListView";
import { useMyTasks } from "@/hooks/useTasks";
import { TASK_ORDERS, taskListSummary, type ListTools, type ListView } from "@/lib/listTools";

import { TaskCard, TaskCardSkeleton } from "./TaskCard";
import { TaskTile } from "./TaskTile";

// Iskelet kart sayisi: ilk ekranda gorunen kart sayisi kadar (Figma: /staff/tasks - yukleniyor)
const SKELETON_KEYS = ["s1", "s2", "s3", "s4"];
// Liste: tek sutun tam kart; kart gorunumu: telefonda iki, genis ekranda uc sutun kare kart
const LIST_CLASS: Record<ListView, string> = {
  list: "grid gap-3",
  grid: "grid grid-cols-2 gap-3 md:grid-cols-3",
};
const URGENT_FIRST: ListTools = { priorities: [], order: "urgent" };

type MyTasksQuery = ReturnType<typeof useMyTasks>;

function Message({ title, text, onClear }: { title: string; text: string; onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
      {onClear && (
        <Button variant="outline" className="mt-2 h-11 px-4" onClick={onClear}>
          Filtreyi temizle
        </Button>
      )}
    </div>
  );
}

interface BodyProps {
  query: MyTasksQuery;
  view: ListView;
  filtered: boolean;
  onClear: () => void;
}

function MyTasksBody({ query, view, filtered, onClear }: BodyProps) {
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
    return filtered ? (
      <Message title="Seçtiğin önceliklerde görev yok." text="Başka bir öncelik seç ya da filtreyi temizle." onClear={onClear} />
    ) : (
      <Message title="Şu an bekleyen görevin yok." text="Sana yeni bir görev atandığında burada görünür." />
    );
  }
  return (
    <ul aria-label="Görevlerin" data-view={view} className={LIST_CLASS[view]}>
      {query.data.items.map((task) => (
        <li key={task.id}>{view === "grid" ? <TaskTile task={task} /> : <TaskCard task={task} />}</li>
      ))}
    </ul>
  );
}

// Personelin gorevleri: tikli oncelik, siralama (varsayilan en acil) ve liste/kart (Figma: 04 Staff > /staff/tasks)
export function MyTasksList() {
  const [tools, setTools] = useState<ListTools>(URGENT_FIRST);
  const [view, setView] = useListView("tasks");
  const query = useMyTasks(tools);
  const count = query.data?.items.length ?? 0;
  const filtered = tools.priorities.length > 0;
  // Hic gorev yoksa araclar gosterilmez; filtre bos sonuc verdiyse temizlemek icin kalir
  const showTools = filtered || count > 0;
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4 md:space-y-6">
      <header className="space-y-2">
        <PageTitle>Görevlerim</PageTitle>
        {count > 0 ? <p className="text-sm text-muted-foreground">{taskListSummary(count, tools.order)}</p> : null}
      </header>
      {showTools ? <ListToolbar tools={tools} orders={TASK_ORDERS} view={view} onTools={setTools} onView={setView} /> : null}
      <MyTasksBody query={query} view={view} filtered={filtered} onClear={() => setTools({ ...tools, priorities: [] })} />
    </div>
  );
}
