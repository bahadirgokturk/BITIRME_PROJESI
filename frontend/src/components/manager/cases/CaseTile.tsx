import Link from "next/link";

import { TILE_CLASS } from "@/components/cases/CaseTile";
import { CaseStatusBadge, PriorityBadge, SlaBadge } from "@/components/tasks/TaskBadges";
import { caseSla, caseSubtitle, type CaseRead } from "@/lib/caseList";
import { formatDateTime, relativeTime } from "@/lib/dates";

// Tum Bildirimler kare karti: tablodaki satirin ayni bilgileri (Figma: ManagerCaseTile)
export function ManagerCaseTile({ item, listPath }: { item: CaseRead; listPath: string }) {
  const sla = caseSla(item);
  return (
    <Link href={`${listPath}/${item.id}`} className={TILE_CLASS}>
      <div className="flex items-start justify-between gap-2">
        <span className="pt-0.5 text-xs text-muted-foreground">{item.case_number}</span>
        <CaseStatusBadge status={item.status} />
      </div>
      <span className="line-clamp-2 text-sm font-medium break-words">{item.title}</span>
      <span className="line-clamp-2 text-xs text-muted-foreground">{caseSubtitle(item)}</span>
      {item.department ? <span className="line-clamp-1 text-xs text-muted-foreground">{item.department.name}</span> : null}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
        {item.priority ? <PriorityBadge priority={item.priority} /> : null}
        {sla ? <SlaBadge view={sla} /> : null}
        <time dateTime={item.created_at} title={formatDateTime(item.created_at)} className="text-xs text-muted-foreground">
          {relativeTime(item.created_at)}
        </time>
      </div>
    </Link>
  );
}
