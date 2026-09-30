// Bildirim yapana gosterilen sade durum: 14 durum yerine 4 adimli ilerleme ya da bilgi kutusu
// (docs/UI_GUIDE.md bolum 4.1)
import type { components } from "@/lib/api/types";

type CaseStatus = components["schemas"]["CaseStatus"];

export const PROGRESS_STEPS = ["Alındı", "Yönlendirildi", "Çalışılıyor", "Çözüldü"] as const;
export type ProgressStep = (typeof PROGRESS_STEPS)[number];
export type StepState = "done" | "current" | "todo";

export type ReporterView =
  | { kind: "progress"; step: ProgressStep }
  | { kind: "notice"; message: string };

const progress = (step: ProgressStep): ReporterView => ({ kind: "progress", step });
const notice = (message: string): ReporterView => ({ kind: "notice", message });

// Record her durumu kapsamak zorunda: backend'e yeni durum eklenirse bu tablo derlenmez.
// REOPENED ve ESCALATED UI_GUIDE'da tanimli degil. Varsayim (ekiple dogrulanacak): yeniden acilan
// bildirim bastan ele alinir, yoneticiye iletilen bildirim bir birimin elindedir.
const REPORTER_VIEWS: Record<CaseStatus, ReporterView> = {
  NEW: progress("Alındı"),
  ANALYZING: progress("Alındı"),
  CLASSIFIED: progress("Alındı"),
  REOPENED: progress("Alındı"),
  ASSIGNED: progress("Yönlendirildi"),
  ACCEPTED: progress("Yönlendirildi"),
  ESCALATED: progress("Yönlendirildi"),
  IN_PROGRESS: progress("Çalışılıyor"),
  RESOLVED: progress("Çözüldü"),
  VERIFICATION: progress("Çözüldü"),
  CLOSED: progress("Çözüldü"),
  NEEDS_INFO: notice("Ek bilgi gerekiyor: Sorunu ve konumu biraz daha netleştirebilir misiniz?"),
  MERGED: notice("Aynı sorun zaten bildirilmiş, bildiriminiz oraya eklendi."),
  REJECTED: notice("Bildiriminiz reddedildi."),
};

export function reporterView(status: CaseStatus): ReporterView {
  return REPORTER_VIEWS[status];
}

export function stepState(step: ProgressStep, current: ProgressStep): StepState {
  const position = PROGRESS_STEPS.indexOf(step) - PROGRESS_STEPS.indexOf(current);
  if (position === 0) {
    return "current";
  }
  return position < 0 ? "done" : "todo";
}
