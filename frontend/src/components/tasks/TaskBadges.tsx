import { ClockIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "cn";

import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Priority,
  type SlaStatus,
  type SlaView,
  type TaskStatus,
} from "@/lib/tasks";

const BADGE_CLASS = "inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium";

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn("size-2 rounded-full", className)} />;
}

function NeutralBadge({ dot, children }: { dot: string; children: ReactNode }) {
  return (
    <span className={cn(BADGE_CLASS, "gap-1.5 bg-muted")}>
      <Dot className={dot} />
      {children}
    </span>
  );
}

// Renk yolculugu (docs/UI_GUIDE.md bolum 4): beklerken turuncu, calisirken gecisli, bitince turkuaz
const STATUS_DOT: Record<TaskStatus, string> = {
  PENDING: "bg-brand-accent-strong",
  ACCEPTED: "bg-brand-accent",
  IN_PROGRESS: "bg-linear-to-r from-brand-accent to-primary",
  COMPLETED: "bg-primary",
  DECLINED: "bg-muted-foreground",
  CANCELLED: "bg-muted-foreground",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <NeutralBadge dot={STATUS_DOT[status]}>{TASK_STATUS_LABELS[status]}</NeutralBadge>;
}

const PRIORITY_DOT: Record<Exclude<Priority, "CRITICAL">, string> = {
  LOW: "bg-muted-foreground",
  MEDIUM: "bg-info",
  HIGH: "bg-brand-accent",
};

// Kritik oncelik renk + ikonla ayrilir (docs/UI_GUIDE.md bolum 4.1)
export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "CRITICAL") {
    return (
      <span className={cn(BADGE_CLASS, "gap-1 bg-destructive/10 text-destructive")}>
        <TriangleAlertIcon aria-hidden className="size-3.5" />
        {PRIORITY_LABELS.CRITICAL}
      </span>
    );
  }
  return <NeutralBadge dot={PRIORITY_DOT[priority]}>{PRIORITY_LABELS[priority]}</NeutralBadge>;
}

const SLA_CLASS: Record<SlaStatus, string> = {
  ON_TRACK: "bg-success/10 text-success",
  AT_RISK: "bg-warning/10 text-warning",
  BREACHED: "bg-destructive/10 text-destructive",
};

// SLA'ya kalan sure: durum renkle birlikte ikon ve metinle anlatilir
export function SlaBadge({ view }: { view: SlaView }) {
  const Icon = view.status === "BREACHED" ? TriangleAlertIcon : ClockIcon;
  return (
    <span className={cn(BADGE_CLASS, "gap-1", SLA_CLASS[view.status])}>
      <Icon aria-hidden className="size-3.5" />
      {view.label}
    </span>
  );
}
