// Zaman cizelgesi olaylarinin bildirim yapana gosterilen sade metinleri (docs/UI_GUIDE.md bolum 5.2).
// Anahtarlar backend'in REPORTER_VISIBLE_EVENTS kumesi (backend/app/services/case_service.py).
const LABELS: Readonly<Record<string, string | undefined>> = {
  CASE_CREATED: "Bildiriminiz alındı",
  ANALYSIS_STARTED: "Bildiriminiz inceleniyor",
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
