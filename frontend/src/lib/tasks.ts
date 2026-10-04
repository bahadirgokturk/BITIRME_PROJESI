// Personel gorev ekranlarinin kurallari: etiketler, SLA'ya kalan sure ve duruma gore eylemler
// (docs/UI_GUIDE.md bolum 4.1 ve 5.3)
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
export type TaskRead = Schemas["TaskRead"];
export type TaskStatus = Schemas["TaskStatus"];
export type Priority = Schemas["Priority"];
export type SlaStatus = Schemas["SlaStatus"];

// Backend siniri (backend/app/core/constants.py TASK_NOTE_MAX_LENGTH): red gerekcesi ve tamamlama notu
export const TASK_NOTE_MAX_LENGTH = 1000;

// Kanit fotografi: backend ile ayni kurallar (backend/app/core/constants.py, MAX_UPLOAD_MB_DEFAULT)
export const EVIDENCE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EVIDENCE_MAX_MB = 10;
const BYTES_PER_MB = 1024 * 1024;
export const EVIDENCE_MAX_BYTES = EVIDENCE_MAX_MB * BYTES_PER_MB;
// Personelin bir bildirime ekleyebilecegi kanit fotografi (MAX_ATTACHMENTS_PER_CASE, tur basina);
// bildirenin fotograflari bu sayiya dahil degil
export const EVIDENCE_MAX_COUNT = 5;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Bekliyor",
  ACCEPTED: "Kabul edildi",
  IN_PROGRESS: "Çalışılıyor",
  COMPLETED: "Tamamlandı",
  DECLINED: "Reddedildi",
  CANCELLED: "İptal edildi",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  CRITICAL: "Kritik",
};

export type TaskAction = "accept" | "start" | "complete";

export interface TaskActions {
  primary: TaskAction | null;
  canDecline: boolean;
}

// Ana eylem duruma gore tektir: Kabul et -> Baslat -> Tamamla. Reddetme yalniz ise baslamadan once
// (backend: PENDING ve ACCEPTED). Biten gorevde eylem yok.
const ACTIONS: Record<TaskStatus, TaskActions> = {
  PENDING: { primary: "accept", canDecline: true },
  ACCEPTED: { primary: "start", canDecline: true },
  IN_PROGRESS: { primary: "complete", canDecline: false },
  COMPLETED: { primary: null, canDecline: false },
  DECLINED: { primary: null, canDecline: false },
  CANCELLED: { primary: null, canDecline: false },
};

export function taskActions(status: TaskStatus): TaskActions {
  return ACTIONS[status];
}

export function duration(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) {
    // "0 dk" yaniltici olur; son dakika da 1 dk olarak gosterilir
    return `${Math.max(minutes, 1)} dk`;
  }
  if (minutes >= MINUTES_PER_DAY) {
    return `${Math.floor(minutes / MINUTES_PER_DAY)} gün`;
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`;
}

export interface SlaView {
  status: SlaStatus;
  label: string;
}

// SLA rozeti: renk backend'in sla_status degerinden, metin bitis zamanina kalan sureden gelir.
// Bitis zamani olmayan ya da ana eylemi kalmayan (bitmis) gorevde rozet gosterilmez.
export function slaView(task: TaskRead, now: Date = new Date()): SlaView | null {
  if (!task.due_at || !task.sla_status || ACTIONS[task.status].primary === null) {
    return null;
  }
  const minutes = Math.floor((new Date(task.due_at).getTime() - now.getTime()) / MS_PER_MINUTE);
  const label = minutes >= 0 ? `${duration(minutes)} kaldı` : `${duration(-minutes)} gecikti`;
  return { status: task.sla_status, label };
}

export function isValidTaskNote(text: string): boolean {
  const length = text.trim().length;
  return length > 0 && length <= TASK_NOTE_MAX_LENGTH;
}

// Dosya sunucuya gonderilmeden once denetlenir: buyuk fotografi yukleyip reddedilmesini beklemek
// telefonda yavastir. Sorun yoksa null doner.
export function evidenceProblem(file: Pick<File, "type" | "size">): string | null {
  if (!EVIDENCE_TYPES.includes(file.type)) {
    return "Yalnız JPG, PNG ya da WEBP fotoğraf eklenebilir.";
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    return `Fotoğraf en fazla ${EVIDENCE_MAX_MB} MB olabilir.`;
  }
  return null;
}

export interface EvidenceSelection {
  photos: File[];
  problem: string | null;
}

// Secilen dosyalari mevcut listeye ekler; kullanilamayan dosya atlanir ve nedeni (ilk sorun) bildirilir
export function addEvidence(current: File[], picked: File[]): EvidenceSelection {
  const usable = picked.filter((file) => evidenceProblem(file) === null);
  const rejected = picked.find((file) => evidenceProblem(file) !== null);
  const photos = [...current, ...usable].slice(0, EVIDENCE_MAX_COUNT);
  if (current.length + usable.length > EVIDENCE_MAX_COUNT) {
    return { photos, problem: `En fazla ${EVIDENCE_MAX_COUNT} fotoğraf eklenebilir.` };
  }
  return { photos, problem: rejected ? evidenceProblem(rejected) : null };
}

type CaseEvent = Pick<Schemas["CaseEventRead"], "event_type" | "metadata">;

// Bu gorev icin yazilmis en son kanit istegi (EVIDENCE_REQUESTED, metadata.message); yoksa null.
// Mesaj backend'den gelir (Resolution Agent), ekran kendisi uydurmaz.
export function evidenceRequest(events: readonly CaseEvent[], taskId: number): string | null {
  const request = events.findLast(
    (event) => event.event_type === "EVIDENCE_REQUESTED" && event.metadata.task_id === taskId,
  );
  const message = request?.metadata.message;
  return typeof message === "string" && message !== "" ? message : null;
}
