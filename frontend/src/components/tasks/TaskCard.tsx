import { MapPinIcon } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { slaView, type TaskRead } from "@/lib/tasks";

import { PriorityBadge, SlaBadge, TaskStatusBadge } from "./TaskBadges";

const CARD_CLASS = "block rounded-lg border bg-card p-4";

// Gorev karti: konum en buyuk metin, sonra is tanimi ve kalan sure (Figma: 02 Components > TaskCard)
export function TaskCard({ task }: { task: TaskRead }) {
  const sla = slaView(task);
  return (
    <Link
      href={`/staff/tasks/${task.id}`}
      className={`${CARD_CLASS} space-y-2.5 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50`}
    >
      <div className="flex items-center justify-between gap-2">
        <TaskStatusBadge status={task.status} />
        {sla ? <SlaBadge view={sla} /> : null}
      </div>
      <div className="flex gap-1.5">
        <MapPinIcon aria-hidden className="mt-1 size-[18px] shrink-0 text-primary" />
        <h2 className="text-lg font-semibold">{task.location.name}</h2>
      </div>
      <p className="text-sm">{task.title}</p>
      <div className="flex items-center gap-2">
        {task.priority ? <PriorityBadge priority={task.priority} /> : null}
        <span className="text-xs text-muted-foreground">{task.case_number}</span>
      </div>
    </Link>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className={`${CARD_CLASS} space-y-3`}>
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-3.5 w-2/5" />
      <Skeleton className="h-6 w-1/3" />
    </div>
  );
}
