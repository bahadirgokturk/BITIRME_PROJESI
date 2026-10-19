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
// REOPENED -> Alindi (bastan ele alinir), ESCALATED -> Yonlendirildi (mudurun karar kuyrugu);
// ekiple kesinlesti, gerekceler docs/UI_GUIDE.md bolum 4.1.
const NEEDS_INFO_PREFIX = "Ek bilgi gerekiyor";

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
  NEEDS_INFO: notice(`${NEEDS_INFO_PREFIX}: Sorunu ve konumu biraz daha netleştirebilir misiniz?`),
  MERGED: notice("Aynı sorun zaten bildirilmiş, bildiriminiz oraya eklendi."),
  REJECTED: notice("Bildiriminiz reddedildi."),
};

// Soru CaseRead.info_request'ten gelir; yoksa genel metin gosterilir
export function reporterView(status: CaseStatus, infoRequest: string | null = null): ReporterView {
  if (status === "NEEDS_INFO" && infoRequest) {
    return notice(`${NEEDS_INFO_PREFIX}: ${infoRequest}`);
  }
  return REPORTER_VIEWS[status];
}

export function stepState(step: ProgressStep, current: ProgressStep): StepState {
  const position = PROGRESS_STEPS.indexOf(step) - PROGRESS_STEPS.indexOf(current);
  if (position === 0) {
    return "current";
  }
  return position < 0 ? "done" : "todo";
}

// Bildirimlerim filtresi: bildirenin gordugu adimlarla ayni ayrim. "Cozulen" = Cozuldu adimi;
// "Acik" = henuz cozulmemis olanlar (ek bilgi bekleyen dahil). Reddedilen ve birlestirilen yalniz "Tumu"nde.
export type MyCasesFilter = "all" | "open" | "solved";

export const MY_CASES_FILTERS: readonly { value: MyCasesFilter; label: string; empty: string }[] = [
  { value: "all", label: "Tümü", empty: "Henüz bildiriminiz yok." },
  { value: "open", label: "Açık", empty: "Açık bildiriminiz yok." },
  { value: "solved", label: "Çözülen", empty: "Çözülen bildiriminiz yok." },
];

// Backend varsayilani ile ayni (backend/app/core/constants.py PAGE_SIZE_DEFAULT)
export const MY_CASES_PAGE_SIZE = 20;

const STATUSES = Object.keys(REPORTER_VIEWS) as CaseStatus[];
const SET_ASIDE: readonly CaseStatus[] = ["MERGED", "REJECTED"];

function isSolved(status: CaseStatus): boolean {
  const view = REPORTER_VIEWS[status];
  return view.kind === "progress" && view.step === "Çözüldü";
}

const FILTER_STATUSES: Record<Exclude<MyCasesFilter, "all">, CaseStatus[]> = {
  open: STATUSES.filter((status) => !isSolved(status) && !SET_ASIDE.includes(status)),
  solved: STATUSES.filter(isSolved),
};

// "Tumu" bildirenin kendi listesidir; filtrede /cases kullanilir, cunku backend bildirenin /cases kapsamini
// yalniz kendi bildirimleriyle sinirlar (backend/app/services/case_service.py scope_for) ve durum filtresi alir
export function myCasesPath(filter: MyCasesFilter, page: number): string {
  const params = new URLSearchParams({ page: String(page), page_size: String(MY_CASES_PAGE_SIZE) });
  if (filter === "all") {
    return `/cases/mine?${params.toString()}`;
  }
  FILTER_STATUSES[filter].forEach((status) => params.append("status", status));
  return `/cases?${params.toString()}`;
}
