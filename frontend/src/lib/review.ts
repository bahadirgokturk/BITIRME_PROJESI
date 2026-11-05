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

// Kuyruktaki bildirimin neden burada oldugu; sekmeler bu gruplarla suzer (Figma: 08 Yeni Stil (A))
export type ReviewGroup = "escalated" | "duplicate" | "verification" | "low_confidence";
export type ReviewGroupFilter = ReviewGroup | "all";

// Ilk eslesen kazanir. ESCALATED kirmizi; etiket durum etiketiyle ayni (UI_GUIDE 4.1, lib/caseList.ts)
const BADGE_RULES: readonly { applies: (item: ReviewItem) => boolean; group: ReviewGroup; badge: ReviewBadge }[] = [
  {
    applies: (item) => item.case.status === "VERIFICATION",
    group: "verification",
    badge: { label: "Çözüm doğrulama", tone: "neutral" },
  },
  {
    applies: (item) => item.case.status === "ESCALATED",
    group: "escalated",
    badge: { label: "Yöneticiye iletildi", tone: "danger" },
  },
  {
    applies: (item) => Boolean(item.possible_duplicate_of),
    group: "duplicate",
    badge: { label: "Olası tekrar", tone: "neutral" },
  },
];
// Kalan durum: Supervisor "emin degilim, insan baksin" dedi (SEND_TO_HUMAN_REVIEW)
const LOW_CONFIDENCE: ReviewBadge = { label: "Düşük güven", tone: "neutral" };

export function reviewBadge(item: ReviewItem): ReviewBadge {
  return BADGE_RULES.find((rule) => rule.applies(item))?.badge ?? LOW_CONFIDENCE;
}

export function reviewGroup(item: ReviewItem): ReviewGroup {
  return BADGE_RULES.find((rule) => rule.applies(item))?.group ?? "low_confidence";
}

// Sekme sirasi ve adlari; bos grup sekmesi gosterilmez
const GROUP_TABS: readonly { value: ReviewGroup; label: string }[] = [
  { value: "escalated", label: "Yöneticiye iletilen" },
  { value: "duplicate", label: "Olası tekrar" },
  { value: "verification", label: "Çözüm doğrulama" },
  { value: "low_confidence", label: "Düşük güven" },
];

export interface ReviewGroupTab {
  value: ReviewGroupFilter;
  label: string;
  count: number;
}

export function reviewGroups(items: readonly ReviewItem[]): ReviewGroupTab[] {
  const tabs = GROUP_TABS.map((tab) => ({
    ...tab,
    count: items.filter((item) => reviewGroup(item) === tab.value).length,
  }));
  return [{ value: "all", label: "Tümü", count: items.length }, ...tabs.filter((tab) => tab.count > 0)];
}

export function inReviewGroup(item: ReviewItem, filter: ReviewGroupFilter): boolean {
  return filter === "all" || reviewGroup(item) === filter;
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
  intake: "Ön inceleme",
  classification: "Sınıflandırma",
  priority: "Öncelik",
  verification: "Doğrulama",
  duplicate: "Tekrar kontrolü",
  routing: "Yönlendirme",
  supervisor: "Karar",
  resolution: "İş kontrolü",
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

// Kare kartta AI onerisi tek satir: tur, oncelik, birim; eksik parca adiyla soylenir (Figma: ReviewTile)
export function suggestionSummary(item: ReviewItem): string {
  const { case_type, priority, department } = item.case;
  const parts = [
    case_type?.name ?? "Tür belirlenmedi",
    priority ? priorityLabel(priority) : "Öncelik belirlenmedi",
    department?.name ?? "Birim belirlenmedi",
  ];
  return `Öneri: ${parts.join(" · ")}`;
}

const PERCENT = 100;

export function confidencePercent(value: number | null): string | null {
  // Sifir guven (ornegin "benzer bildirim yok") okuyana bir sey soylemez; cubuk da cizilmez
  return value === null || value === 0 ? null : `%${Math.round(value * PERCENT)}`;
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
      // Sifir agirlik okuyana bir sey soylemez ("... yok. 0" gibi gorunur)
      weight: typeof reason.weight === "number" && reason.weight !== 0 ? reason.weight : null,
    }));
}

// Agirlik "Ayrintilar" altinda gerekceyle birlikte okunur (ornek: Konumun onemi, agirlik +8)
export function weightDetail(reason: DecisionReason): string | null {
  if (reason.weight === null) {
    return null;
  }
  const sign = reason.weight > 0 ? "+" : "";
  return `${reason.message} · ağırlık ${sign}${reason.weight}`;
}

type CaseRead = Schemas["CaseRead"];
export type OverrideField = Schemas["OverrideField"];

// Manager'in duzeltebildigi alanlar (POST /cases/{id}/override field)
export const OVERRIDE_FIELD_LABELS: Record<OverrideField, string> = {
  case_type: "Tür",
  priority: "Öncelik",
  department: "Birim",
};

// Duzeltme penceresi AI'in onerisiyle acilir; override kod bekler (tur/birim kodu, oncelik enum'u)
const CURRENT_VALUE: Record<OverrideField, (item: CaseRead) => string> = {
  case_type: (item) => item.case_type?.code ?? "",
  priority: (item) => item.priority ?? "",
  department: (item) => item.department?.code ?? "",
};

export function currentOverrideValue(item: CaseRead, field: OverrideField): string {
  return CURRENT_VALUE[field](item);
}

interface DecisionNames {
  agent_name: string;
  decision: string;
  agent_label?: string | null;
  decision_label?: string | null;
}

// Turkce basliklar API'den gelir (agent_label, decision_label); yoksa yerel ad ve karar kodu gosterilir
export function decisionTitles(decision: DecisionNames): { agent: string; decision: string } {
  return {
    agent: decision.agent_label ?? agentLabel(decision.agent_name),
    decision: decision.decision_label ?? decision.decision,
  };
}
