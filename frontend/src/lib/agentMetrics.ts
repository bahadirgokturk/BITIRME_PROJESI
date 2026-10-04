// "Yapay zeka performansi" ekraninin kurallari (docs/UI_GUIDE.md bolum 5.4, docs/ANALYTICS.md bolum 3).
// Teknik terimler yerine duz Turkce: agent = adim, override = duzeltilme, precision = dogru tespit.
import type { components } from "@/lib/api/types";
import { formatCount, formatPercent } from "@/lib/analytics";

type Schemas = components["schemas"];
export type AgentMetricsRead = Schemas["AgentMetricsRead"];
export type AgentMetric = Schemas["AgentMetric"];

const PERCENT = 100;

type RateKey = Exclude<keyof AgentMetricsRead, "period" | "agents">;

const KPI_CARDS: readonly { key: RateKey; label: string; hint: string }[] = [
  { key: "automation_pct", label: "Otomasyon Oranı", hint: "Kimse dokunmadan doğru personele atanan bildirimler" },
  { key: "human_review_pct", label: "Müdür İncelemesi Oranı", hint: "Müdürün karar vermesi gereken bildirimler" },
  { key: "classification_accuracy_pct", label: "Doğru Tür Tahmini", hint: "Sorunun türünü doğru bilme oranı" },
  {
    key: "duplicate_precision_pct",
    label: "Doğru Tekrar Tespiti",
    hint: "\"Aynı sorun\" dediği bildirimlerin gerçekten aynı olma oranı",
  },
];

export interface AgentKpiView {
  label: string;
  value: string;
  hint: string;
}

export function agentKpis(metrics: AgentMetricsRead): AgentKpiView[] {
  return KPI_CARDS.map((card) => ({ label: card.label, value: formatPercent(metrics[card.key]), hint: card.hint }));
}

export interface AgentRowView {
  key: string;
  name: string;
  decisions: string;
  confidence: string;
  overrideRate: string;
}

// Guven backend'den 0-1 araliginda gelir (AgentResult.confidence), ekranda yuzde gosterilir
function formatConfidence(value: number | null): string {
  return formatPercent(value === null ? null : value * PERCENT);
}

export function agentRows(agents: readonly AgentMetric[]): AgentRowView[] {
  return agents.map((agent) => ({
    key: agent.agent,
    name: agent.label,
    decisions: formatCount(agent.decisions),
    confidence: formatConfidence(agent.avg_confidence),
    overrideRate: formatPercent(agent.override_rate_pct),
  }));
}

export function mostCorrectedHeadline(agents: readonly AgentMetric[]): string {
  const top = [...agents].sort((a, b) => (b.override_rate_pct ?? 0) - (a.override_rate_pct ?? 0))[0];
  if (!top || !top.override_rate_pct) {
    return "Yapay zekâ adımları";
  }
  return `En çok düzeltilen adım: ${top.label} (${formatPercent(top.override_rate_pct)})`;
}
