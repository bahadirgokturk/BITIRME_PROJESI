// Yonetim > Yapay Zeka Politikalari kurallari (docs/UI_GUIDE.md bolum 5.5, docs/API.md "/admin/agent-policies").
// Politika, tur eklenirken backend'de acilir; burada yalniz duzenlenir (ekleme ve silme yok).
import { normalizeCode } from "@/lib/adminDepartments";
import type { components } from "@/lib/api/types";
import { CATEGORY_LABELS } from "@/lib/reports";

type Schemas = components["schemas"];
export type AgentPolicy = Schemas["AgentPolicyRead"];
export type AutonomyLevel = Schemas["AutonomyLevel"];

const LOCALE = "tr-TR";
const UNKNOWN_TYPE = "–";
const PERCENT = 100;

// docs/AGENTS.md bolum 5: yapay zekanin ne kadar kendi basina karar verecegi (ekranda duz Turkce)
export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  L1_AUTONOMOUS: "Kendi uygular",
  L2_NOTIFY: "Uygular, müdüre haber verir",
  L3_ESCALATE: "Müdür karar verir",
};

// Rozet tonu: kendi uygulayan yesil, haber veren turkuaz, mudure birakan amber (Figma: 08 Yeni Stil (A))
export const AUTONOMY_TONES: Record<AutonomyLevel, "success" | "info" | "warning"> = {
  L1_AUTONOMOUS: "success",
  L2_NOTIFY: "info",
  L3_ESCALATE: "warning",
};

export const AUTONOMY_NOTES: Record<AutonomyLevel, string> = {
  L1_AUTONOMOUS: "Yapay zekâ türü belirler ve görevi kendisi açar.",
  L2_NOTIFY: "Görevi açar; birim müdürü bilgilendirilir.",
  L3_ESCALATE: "Bildirim İnceleme Kuyruğu'na düşer; kararı müdür verir.",
};

interface TypeName {
  id: number;
  name: string;
  code: string;
}

export interface AgentPolicyRow {
  policy: AgentPolicy;
  name: string;
  // Kategori kapsamli politikada tur kodu yoktur
  code: string | null;
}

// Politika bir ture ya da (tur yoksa) bir kategoriye baglidir
function toRow(policy: AgentPolicy, types: readonly TypeName[] | undefined): AgentPolicyRow {
  if (policy.case_type_id === null) {
    const name = policy.category ? `${CATEGORY_LABELS[policy.category]} kategorisi` : UNKNOWN_TYPE;
    return { policy, name, code: null };
  }
  const type = types?.find((candidate) => candidate.id === policy.case_type_id);
  return { policy, name: type?.name ?? UNKNOWN_TYPE, code: type?.code ?? null };
}

export function agentPolicyRows(policies: readonly AgentPolicy[], types: readonly TypeName[] | undefined): AgentPolicyRow[] {
  return policies.map((policy) => toRow(policy, types)).sort((a, b) => a.name.localeCompare(b.name, LOCALE));
}

export interface AgentPolicyFilters {
  search: string;
  autonomy: AutonomyLevel | null;
}

export const NO_AGENT_POLICY_FILTERS: AgentPolicyFilters = { search: "", autonomy: null };

// Ad Turkce kurallarla, kod ise kod bicimine cevrilerek aranir ("soap empty" yazinca "SOAP_EMPTY" bulunur)
export function filterAgentPolicies(rows: readonly AgentPolicyRow[], filters: AgentPolicyFilters): AgentPolicyRow[] {
  const text = filters.search.trim();
  const query = text.toLocaleLowerCase(LOCALE);
  const codeQuery = normalizeCode(text);
  return rows.filter(
    (row) =>
      (filters.autonomy === null || row.policy.autonomy_level === filters.autonomy) &&
      (row.name.toLocaleLowerCase(LOCALE).includes(query) || (row.code?.includes(codeQuery) ?? false)),
  );
}

// API 0-1 arasi deger tutar; ekranda yuzde gosterilir ve yuzde olarak yazilir
export const toPercent = (value: number) => Math.round(value * PERCENT);

export function formatConfidence(value: number): string {
  return `%${toPercent(value)}`;
}

export interface AgentPolicyForm {
  autonomy_level: AutonomyLevel;
  confidence_pct: string;
}

// Mudure haber verme seviyeden gelir (L2 haber verir); ayri alan formda yok (#93)
export function formFromAgentPolicy(policy: AgentPolicy): AgentPolicyForm {
  return {
    autonomy_level: policy.autonomy_level,
    confidence_pct: String(toPercent(policy.min_confidence_auto)),
  };
}

export type AgentPolicyFormProblems = Partial<Record<keyof AgentPolicyForm, string>>;

const WHOLE_NUMBER = /^\d+$/;

export function agentPolicyFormProblems(form: AgentPolicyForm): AgentPolicyFormProblems {
  const text = form.confidence_pct.trim();
  const valid = WHOLE_NUMBER.test(text) && Number(text) <= PERCENT;
  return valid ? {} : { confidence_pct: "Güven eşiği 0 ile 100 arasında bir tam sayı olmalı." };
}

// Yalniz denetimden gecmis formla cagrilir
export function toAgentPolicyBody(form: AgentPolicyForm) {
  return {
    autonomy_level: form.autonomy_level,
    min_confidence_auto: Number(form.confidence_pct.trim()) / PERCENT,
  };
}
