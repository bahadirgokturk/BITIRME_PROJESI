// Zaman cizelgesi olaylarinin bildirim yapana gosterilen sade metinleri (docs/UI_GUIDE.md bolum 5.2).
// Anahtarlar backend'in REPORTER_VISIBLE_EVENTS kumesi (backend/app/services/case_service.py).
const LABELS: Readonly<Record<string, string | undefined>> = {
  CASE_CREATED: "Bildiriminiz alındı",
  ANALYSIS_STARTED: "Bildiriminiz inceleniyor",
  AI_CLASSIFIED: "Bildiriminiz incelendi",
  ROUTED: "Sorumlu birim belirlendi",
  INFO_REQUESTED: "Sizden ek bilgi istendi",
  INFO_PROVIDED: "Ek bilgi gönderildi",
  CASE_MERGED: "Aynı sorun zaten bildirilmiş, bildiriminiz oraya eklendi",
  TASK_CREATED: "İlgili birime yönlendirildi",
  WORK_STARTED: "Görevli çalışmaya başladı",
  WORK_COMPLETED: "Görevli işi tamamladı",
  CASE_CLOSED: "Bildiriminiz kapatıldı",
  CASE_REOPENED: "Bildiriminiz yeniden açıldı",
  CASE_REJECTED: "Bildiriminiz reddedildi",
  FEEDBACK_SUBMITTED: "Değerlendirmeniz alındı",
};

// event_type API'de serbest metin: bilinmeyen olay gizlenmez, notr metinle gosterilir
const UNKNOWN_EVENT_LABEL = "Bildiriminiz güncellendi";

export function timelineLabel(eventType: string): string {
  return LABELS[eventType] ?? UNKNOWN_EVENT_LABEL;
}

// Uzun zaman cizelgesi kapali gelir: once en son adimlar (bildirim su an nerede), oncekiler istenince.
// Bir iki adimi gizlemek icin dugme koymaya degmez; esigin altindaki cizelge butun gosterilir.
const COLLAPSED_STEPS = 3;
const COLLAPSE_FROM = COLLAPSED_STEPS + 2;

export function collapsedTimeline<T>(steps: readonly T[], expanded: boolean): { visible: readonly T[]; hidden: number } {
  if (steps.length < COLLAPSE_FROM) {
    return { visible: steps, hidden: 0 };
  }
  const hidden = steps.length - COLLAPSED_STEPS;
  return { visible: expanded ? steps : steps.slice(hidden), hidden };
}
