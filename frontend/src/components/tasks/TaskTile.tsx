import Link from "next/link";

import { TILE_CLASS } from "@/components/cases/CaseTile";
import { slaView, type TaskRead } from "@/lib/tasks";

import { PriorityBadge, SlaBadge, TaskStatusBadge } from "./TaskBadges";

// Gorevlerim kare karti: durum, konum (en buyuk), is ve altta oncelik + kalan sure (Figma: TaskTile)
export function TaskTile({ task }: { task: TaskRead }) {
  const sla = slaView(task);
  return (
    <Link href={`/staff/tasks/${task.id}`} className={TILE_CLASS}>
      <div>
        <TaskStatusBadge status={task.status} />
      </div>
      <h2 className="line-clamp-3 text-sm font-semibold break-words">{task.location.name}</h2>
      <p className="line-clamp-2 text-xs text-muted-foreground">{task.title}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
        {task.priority ? <PriorityBadge priority={task.priority} /> : null}
        {sla ? <SlaBadge view={sla} /> : null}
      </div>
    </Link>
  );
}
