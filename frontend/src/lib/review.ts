// Manager inceleme kuyrugu kurallari (docs/UI_GUIDE.md bolum 5.4, docs/API.md "Manager islemleri").
// Hangi rozetin ve hangi butonlarin gosterilecegi burada; son karari backend verir.
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type ReviewItem = Schemas["ReviewItemRead"];
export type Priority = Schemas["Priority"];

export type BadgeTone = "danger" | "neutral";

export interface ReviewBadge {
  label: string;
  tone: BadgeTone;
}

// Ilk eslesen kazanir. ESCALATED kirmizi: UI_GUIDE 4.1'de "Yoneticiye iletildi" kirmizi
const BADGE_RULES: readonly { applies: (item: ReviewItem) => boolean; badge: ReviewBadge }[] = [
  { applies: (item) => item.case.status === "VERIFICATION", badge: { label: "Çözüm doğrulama", tone: "neutral" } },
  { applies: (item) => item.case.status === "ESCALATED", badge: { label: "Yöneticiye iletildi", tone: "danger" } },
  { applies: (item) => Boolean(item.possible_duplicate_of), badge: { label: "Olası tekrar", tone: "neutral" } },
];
// Kalan durum: Supervisor "emin degilim, insan baksin" dedi (SEND_TO_HUMAN_REVIEW)
const LOW_CONFIDENCE: ReviewBadge = { label: "Düşük güven", tone: "neutral" };

export function reviewBadge(item: ReviewItem): ReviewBadge {
  return BADGE_RULES.find((rule) => rule.applies(item))?.badge ?? LOW_CONFIDENCE;
}

export interface ReviewActions {
  approve: boolean;
  close: boolean;
  merge: boolean;
  override: boolean;
  reject: boolean;
}

// Isi biten (VERIFICATION) bildirimde yalniz kapatma var: atama/reddetme backend'de 409 olur.
// Onay = AI'in onerdigi birime atama; birim yoksa onaylanacak bir oneri de yoktur.
export function reviewActions(item: ReviewItem): ReviewActions {
  const verifying = item.case.status === "VERIFICATION";
  return {
    approve: !verifying && item.case.department !== null,
    close: verifying,
    merge: !verifying && Boolean(item.possible_duplicate_of),
    override: !verifying,
    reject: !verifying,
  };
}

// Agent adlari backend'deki sinif adlari (backend/app/agents/*.py name)
const AGENT_LABELS: Readonly<Record<string, string | undefined>> = {
  intake: "Ön kontrol",
  classification: "Sınıflandırma",
  priority: "Öncelik",
  verification: "Doğrulama",
  duplicate: "Tekrar kontrolü",
  routing: "Yönlendirme",
  supervisor: "Karar (Supervisor)",
  resolution: "Çözüm kontrolü",
  monitoring: "İzleme",
};

export function agentLabel(name: string): string {
  return AGENT_LABELS[name] ?? name;
}

// Etiketler UI_GUIDE 4.1 oncelik tablosuyla ayni
export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  CRITICAL: "Kritik",
};

export function priorityLabel(priority: Priority): string {
  return PRIORITY_LABELS[priority];
}

const PERCENT = 100;

export function confidencePercent(value: number | null): string | null {
  return value === null ? null : `%${Math.round(value * PERCENT)}`;
}

export interface DecisionReason {
  code: string;
  message: string;
  weight: number | null;
}

// Gerekceler API'de serbest JSON ({code, message, weight?, evidence}); mesaji olmayan madde gosterilmez
export function decisionReasons(reasons: readonly Record<string, unknown>[]): DecisionReason[] {
  return reasons
    .filter((reason) => typeof reason.message === "string" && reason.message !== "")
    .map((reason) => ({
      code: typeof reason.code === "string" ? reason.code : "",
      message: reason.message as string,
      weight: typeof reason.weight === "number" ? reason.weight : null,
    }));
}
