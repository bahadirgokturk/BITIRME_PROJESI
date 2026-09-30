import { cn } from "cn";

import { PROGRESS_STEPS, stepState, type ProgressStep, type ReporterView, type StepState } from "@/lib/status";

const BAR_CLASS: Record<StepState, string> = {
  done: "bg-primary",
  current: "bg-primary",
  todo: "bg-border",
};

// Telefonda 4 etiket yan yana sigmiyor (375 px): yalniz aktif adim yazilir, digerleri ekran
// okuyucuya kalir
const LABEL_CLASS: Record<StepState, string> = {
  done: "text-foreground max-sm:sr-only",
  current: "font-semibold whitespace-nowrap text-foreground",
  todo: "text-muted-foreground max-sm:sr-only",
};

// Durum yalniz renkle degil metinle de anlatilir: aktif adim kalin ve aria-current (UI_GUIDE bolum 8)
function CaseProgress({ step }: { step: ProgressStep }) {
  return (
    <ol aria-label="İlerleme" className="grid grid-cols-4 gap-1">
      {PROGRESS_STEPS.map((label) => {
        const state = stepState(label, step);
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined} className="space-y-1.5">
            <span aria-hidden className={cn("block h-1 rounded-full", BAR_CLASS[state])} />
            <span className={cn("block text-xs", LABEL_CLASS[state])}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function CaseStatusView({ view }: { view: ReporterView }) {
  if (view.kind === "notice") {
    return <p className="rounded-lg bg-muted px-4 py-3 text-sm">{view.message}</p>;
  }
  return <CaseProgress step={view.step} />;
}
