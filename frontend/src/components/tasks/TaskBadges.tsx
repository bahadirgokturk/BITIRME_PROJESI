import { ClockIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "cn";

import { CASE_STATUS_LABELS, CASE_STATUS_TONES, type CaseStatus, type StatusTone } from "@/lib/caseList";
import {
  PRIORITY_LABELS,
  PRIORITY_TONES,
  TASK_STATUS_LABELS,
  type Priority,
  type PriorityTone,
  type SlaStatus,
  type SlaView,
  type TaskStatus,
} from "@/lib/tasks";

// Yeni stil (Figma: 08 Yeni Stil (A)): cerceveli rozet; durum yuvarlak hatli ve noktali,
// oncelik ve sure koseli. Ton data-tone ile de okunur; renk yaninda her zaman metin yazilir (UI_GUIDE bolum 8)
const BADGE_CLASS =
  "inline-flex h-6 shrink-0 items-center gap-1.5 border px-2 text-xs font-medium whitespace-nowrap";
const STATUS_SHAPE = "rounded-full";
const TAG_SHAPE = "rounded-md";
const ALERT_CLASS = "border-destructive/30 bg-destructive/5 text-destructive";
const WARNING_CLASS = "border-warning/30 bg-warning/5 text-warning";

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", className)} />;
}

function StatusPill({ tone, dot, children }: { tone: string; dot: string; children: ReactNode }) {
  return (
    <span data-tone={tone} className={cn(BADGE_CLASS, STATUS_SHAPE)}>
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
  return (
    <StatusPill tone={status} dot={STATUS_DOT[status]}>
      {TASK_STATUS_LABELS[status]}
    </StatusPill>
  );
}

const TONE_DOT: Record<Exclude<StatusTone, "alert">, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  warning: "bg-warning",
  waiting: STATUS_DOT.PENDING,
  accepted: STATUS_DOT.ACCEPTED,
  working: STATUS_DOT.IN_PROGRESS,
  solved: "bg-primary",
  closed: "bg-primary-strong",
};

// Bildirim durumu (mudur ekranlari); renk yaninda her zaman durum adi da yazilir (UI_GUIDE bolum 4.1)
export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const tone = CASE_STATUS_TONES[status];
  if (tone === "alert") {
    return (
      <span data-tone={tone} className={cn(BADGE_CLASS, STATUS_SHAPE, "gap-1", ALERT_CLASS)}>
        <TriangleAlertIcon aria-hidden className="size-3.5" />
        {CASE_STATUS_LABELS[status]}
      </span>
    );
  }
  return (
    <StatusPill tone={tone} dot={TONE_DOT[tone]}>
      {CASE_STATUS_LABELS[status]}
    </StatusPill>
  );
}

const PRIORITY_CLASS: Record<PriorityTone, string> = {
  plain: "",
  warning: WARNING_CLASS,
  critical: cn("gap-1", ALERT_CLASS),
};

// Kritik oncelik renk + ikonla ayrilir (docs/UI_GUIDE.md bolum 4.1)
export function PriorityBadge({ priority }: { priority: Priority }) {
  const tone = PRIORITY_TONES[priority];
  return (
    <span data-tone={tone} className={cn(BADGE_CLASS, TAG_SHAPE, PRIORITY_CLASS[tone])}>
      {tone === "critical" ? <TriangleAlertIcon aria-hidden className="size-3.5" /> : null}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const SLA_CLASS: Record<SlaStatus, string> = {
  ON_TRACK: "border-success/30 bg-success/5 text-success",
  AT_RISK: WARNING_CLASS,
  BREACHED: ALERT_CLASS,
};

// SLA'ya kalan sure: durum renkle birlikte ikon ve metinle anlatilir
export function SlaBadge({ view }: { view: SlaView }) {
  const Icon = view.status === "BREACHED" ? TriangleAlertIcon : ClockIcon;
  return (
    <span data-tone={view.status} className={cn(BADGE_CLASS, TAG_SHAPE, "gap-1", SLA_CLASS[view.status])}>
      <Icon aria-hidden className="size-3.5" />
      {view.label}
    </span>
  );
}
