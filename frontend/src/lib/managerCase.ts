// Mudurun bildirim detay ekrani kurallari (docs/UI_GUIDE.md bolum 5.4, Figma: 05 Manager > /manager/cases/[id]).
// Bildiren ayni bildirimi sade haliyle gorur (lib/timeline.ts, lib/status.ts); burada mudurun gordugu ayrintilar var.
import type { components } from "@/lib/api/types";
import { formatDateTime } from "@/lib/dates";
import { CATEGORY_LABELS } from "@/lib/reports";
import { agentLabel } from "@/lib/review";

type Schemas = components["schemas"];
type CaseRead = Schemas["CaseRead"];
type CaseEvent = Schemas["CaseEventRead"];
type CaseStatus = Schemas["CaseStatus"];

export interface InfoField {
  label: string;
  value: string;
}

const UNDECIDED = "Henüz belirlenmedi";
const SEPARATOR = " · ";
// Bildirenin verdigi puanin ust siniri (docs/API.md "feedback")
const MAX_RATING = 5;

function typeText(item: CaseRead): string {
  if (!item.case_type) {
    return UNDECIDED;
  }
  return item.category ? `${item.case_type.name}${SEPARATOR}${CATEGORY_LABELS[item.category]}` : item.case_type.name;
}

type OptionalField = [label: string, value: string | null];

// Henuz olmamis seyler (cozum, kapanis, puan) ve sifir sayilar gosterilmez
function optionalFields(item: CaseRead): OptionalField[] {
  return [
    ["Hedef süre", item.due_at ? formatDateTime(item.due_at) : null],
    ["Çözüm", item.resolved_at ? formatDateTime(item.resolved_at) : null],
    ["Kapanış", item.closed_at ? formatDateTime(item.closed_at) : null],
    ["Bildirenin puanı", item.satisfaction_rating === null ? null : `${item.satisfaction_rating} / ${MAX_RATING}`],
    ["Aynı sorunu bildirenler", item.duplicate_count > 0 ? `${item.duplicate_count} bildirim daha` : null],
    ["Yeniden açılma", item.reopened_count > 0 ? `${item.reopened_count} kez` : null],
  ];
}

export function caseInfoFields(item: CaseRead): InfoField[] {
  const always: InfoField[] = [
    { label: "Açıklama", value: item.description },
    { label: "Konum", value: item.location.name },
    { label: "Tür", value: typeText(item) },
    { label: "Birim", value: item.department?.name ?? UNDECIDED },
    { label: "Açılış", value: formatDateTime(item.created_at) },
  ];
  const optional = optionalFields(item).flatMap(([label, value]) => (value === null ? [] : [{ label, value }]));
  return [...always, ...optional];
}

// Anahtarlar backend'in CaseEventType listesi (backend/app/models/enums.py)
const EVENT_LABELS: Readonly<Record<string, string | undefined>> = {
  CASE_CREATED: "Bildirim açıldı",
  ANALYSIS_STARTED: "Yapay zekâ incelemeye başladı",
  AI_CLASSIFIED: "Tür belirlendi",
  DUPLICATE_CHECKED: "Tekrar kontrolü yapıldı",
  VERIFICATION_SCORED: "Bildirimin doğruluğu değerlendirildi",
  PRIORITY_CALCULATED: "Öncelik hesaplandı",
  ROUTED: "Birime yönlendirildi",
  SUPERVISOR_DECIDED: "Yapay zekâ kararını verdi",
  HUMAN_REVIEW_REQUESTED: "Müdür incelemesi istendi",
  INFO_REQUESTED: "Bildirenden ek bilgi istendi",
  INFO_PROVIDED: "Bildiren ek bilgi gönderdi",
  CASE_MERGED: "Başka bir bildirimle birleştirildi",
  TASK_CREATED: "Görev açıldı",
  TASK_ACCEPTED: "Görev kabul edildi",
  TASK_DECLINED: "Görev geri çevrildi",
  TASK_REASSIGNED: "Görev başka personele verildi",
  WORK_STARTED: "Çalışma başladı",
  WORK_COMPLETED: "İş tamamlandı",
  EVIDENCE_UPLOADED: "Kanıt fotoğrafı yüklendi",
  RESOLUTION_EVALUATED: "Yapılan iş kontrol edildi",
  EVIDENCE_REQUESTED: "Kanıt fotoğrafı istendi",
  RESOLUTION_VERIFIED: "Çözüm doğrulandı",
  CASE_CLOSED: "Bildirim kapatıldı",
  CASE_REOPENED: "Bildirim yeniden açıldı",
  CASE_REJECTED: "Bildirim reddedildi",
  SLA_WARNING: "Hedef süre dolmak üzere",
  SLA_BREACHED: "Hedef süre aşıldı",
  REASSIGN_RECOMMENDED: "Yeniden atama önerildi",
  ESCALATED: "Müdüre yükseltildi",
  DECISION_OVERRIDDEN: "Yapay zekâ kararı düzeltildi",
  COMMENT_ADDED: "Yorum yazıldı",
  FEEDBACK_SUBMITTED: "Bildiren değerlendirdi",
};

// event_type API'de serbest metin: bilinmeyen olay gizlenmez, notr metinle gosterilir
const UNKNOWN_EVENT_LABEL = "Bildirim güncellendi";

type Metadata = CaseEvent["metadata"];

// Olayin tasidigi ayrinti varsa metne katilir; yoksa genel metin kalir
const DETAILED: Readonly<Record<string, ((metadata: Metadata) => string | null) | undefined>> = {
  FEEDBACK_SUBMITTED: ({ rating }) => (typeof rating === "number" ? `Bildiren ${rating} puan verdi` : null),
  COMMENT_ADDED: ({ is_internal: internal }) => (internal === true ? "İç not eklendi" : null),
  CASE_MERGED: ({ merged_case_number: merged }) =>
    typeof merged === "string" ? `${merged} bu bildirimle birleştirildi` : null,
};

export function managerEventLabel(event: CaseEvent): string {
  const detailed = DETAILED[event.event_type]?.(event.metadata) ?? null;
  return detailed ?? EVENT_LABELS[event.event_type] ?? UNKNOWN_EVENT_LABEL;
}

const AI = "Yapay zekâ";

// Olayda yalniz kullanici numarasi gelir (ad ve rol yok); kimin yaptigi olayin turunden anlasilir
const PERSON_BY_EVENT: Readonly<Record<string, string | undefined>> = {
  CASE_CREATED: "Bildiren",
  INFO_PROVIDED: "Bildiren",
  CASE_REOPENED: "Bildiren",
  FEEDBACK_SUBMITTED: "Bildiren",
  TASK_ACCEPTED: "Personel",
  TASK_DECLINED: "Personel",
  WORK_STARTED: "Personel",
  WORK_COMPLETED: "Personel",
  EVIDENCE_UPLOADED: "Personel",
  INFO_REQUESTED: "Müdür",
  CASE_REJECTED: "Müdür",
  CASE_MERGED: "Müdür",
  CASE_CLOSED: "Müdür",
  TASK_CREATED: "Müdür",
  TASK_REASSIGNED: "Müdür",
  DECISION_OVERRIDDEN: "Müdür",
};

const ACTORS: Record<Schemas["ActorType"], (event: CaseEvent) => string> = {
  AGENT: (event) => (event.agent_name ? `${AI}${SEPARATOR}${agentLabel(event.agent_name)}` : AI),
  SYSTEM: () => "Sistem",
  USER: (event) => PERSON_BY_EVENT[event.event_type] ?? "Kullanıcı",
};

export function eventActor(event: CaseEvent): string {
  return ACTORS[event.actor_type](event);
}

// Inceleme kuyrugundaki kayitlar (backend/app/repositories/review_repository.py): mudure yukseltilenler ve
// yapay zekanin emin olamadigi, siniflandirilmis ya da dogrulama bekleyen bildirimler
const UNSURE_STATUSES: readonly CaseStatus[] = ["CLASSIFIED", "VERIFICATION"];

export function awaitsManager(item: CaseRead): boolean {
  return item.status === "ESCALATED" || (item.needs_human_review && UNSURE_STATUSES.includes(item.status));
}

type Attachment = Schemas["AttachmentRead"];

export interface CasePhoto {
  attachment: Attachment;
  // Kucuk resmin altindaki yazi
  caption: string;
  // Ekran okuyucu icin sirali ad: "Kanit fotografi 2"
  label: string;
}

const PHOTO_CAPTIONS: Record<Attachment["kind"], string> = {
  REPORT: "Bildirim fotoğrafı",
  EVIDENCE: "Kanıt fotoğrafı",
};
const IMAGE_PREFIX = "image/";

// Yalniz goruntuler gosterilir (video kucuk resim olarak cizilemez); her tur kendi icinde numaralanir
export function photoList(attachments: readonly Attachment[]): CasePhoto[] {
  const counts = new Map<Attachment["kind"], number>();
  return attachments
    .filter((attachment) => attachment.mime_type.startsWith(IMAGE_PREFIX))
    .map((attachment) => {
      const order = (counts.get(attachment.kind) ?? 0) + 1;
      counts.set(attachment.kind, order);
      const caption = PHOTO_CAPTIONS[attachment.kind];
      return { attachment, caption, label: `${caption} ${order}` };
    });
}
