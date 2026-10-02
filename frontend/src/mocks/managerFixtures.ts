// Sahte inceleme kuyrugu: manager ekrani (/manager/review-queue) icin uc farkli neden.
// Gerekce metinleri backend agent'larindakiyle ayni (backend/app/agents/supervisor.py, priority.py).
import type { components } from "@/lib/api/types";

import { EMPTY_CASE } from "./caseFixtures";

type Schemas = components["schemas"];

// Konumlar caseFixtures.ts ve fixtures.ts LOCATIONS ile ayni (id 4 ve 5)
const WC = { id: 4, kind: "WC", name: "B Blok 2. Kat Erkek WC", path: "KMP/B/B-2/B-2-WCM" } as const;
const AMFI = { id: 5, kind: "ROOM", name: "B201 Amfi", path: "KMP/B/B-2/B-201" } as const;
const SUPPORT = { id: 1, code: "SUPPORT_SERVICES", name: "Destek Hizmetleri Şube Müdürlüğü" };
const MAINTENANCE = { id: 2, code: "MAINTENANCE", name: "Bakım Onarım ve Peyzaj Şube Müdürlüğü" };

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const SAFETY_CASE: Schemas["CaseRead"] = {
  ...EMPTY_CASE,
  id: 131,
  case_number: "CASE-000131",
  title: "Laboratuvarda priz kıvılcım çıkarıyor",
  description: "B201'in yanındaki laboratuvarda priz kıvılcım çıkarıyor, yanık kokusu var.",
  location: AMFI,
  status: "ESCALATED",
  case_type: { id: 20, code: "ELECTRICAL_FAULT", name: "Elektrik arızası" },
  category: "TECHNICAL",
  department: MAINTENANCE,
  priority: "CRITICAL",
  created_at: minutesAgo(25),
};

const DUPLICATE_CASE: Schemas["CaseRead"] = {
  ...EMPTY_CASE,
  id: 128,
  case_number: "CASE-000128",
  title: "Amfide projeksiyon yine bozuk",
  description: "B201 amfide projeksiyon yine açılmıyor.",
  location: AMFI,
  status: "CLASSIFIED",
  case_type: { id: 15, code: "PROJECTOR_FAILURE", name: "Projeksiyon arızası" },
  category: "TECHNICAL",
  department: MAINTENANCE,
  priority: "MEDIUM",
  needs_human_review: true,
  created_at: minutesAgo(120),
};

const UNSURE_CASE: Schemas["CaseRead"] = {
  ...EMPTY_CASE,
  id: 126,
  case_number: "CASE-000126",
  title: "Koridorda garip bir ses var",
  description: "Tuvaletin önündeki koridorda tavandan garip bir ses geliyor.",
  location: WC,
  status: "CLASSIFIED",
  case_type: { id: 99, code: "OTHER", name: "Diğer" },
  category: "OTHER",
  department: SUPPORT,
  priority: "LOW",
  needs_human_review: true,
  created_at: minutesAgo(180),
};

// Backend siralamasi: en kritik ve en eski once
export const REVIEW_ITEMS: Schemas["ReviewItemRead"][] = [
  {
    case: SAFETY_CASE,
    reason_code: "RULE_3_ESCALATE",
    reason: "Güvenlik açısından kritik ya da insan kararı gerektiren tür; müdüre iletilir.",
    confidence: 0.91,
    possible_duplicate_of: null,
  },
  {
    case: DUPLICATE_CASE,
    reason_code: "RULE_5_SEND_TO_HUMAN_REVIEW",
    reason: "Aynı sorun zaten bildirilmiş olabilir; birleştirmeden önce kontrol edin.",
    confidence: 0.84,
    possible_duplicate_of: { id: 102, case_number: "CASE-000102", title: "Amfide projeksiyon çalışmıyor" },
  },
  {
    case: UNSURE_CASE,
    reason_code: "RULE_5_SEND_TO_HUMAN_REVIEW",
    reason: "Sınıflandırma ya da yönlendirme yeterince kesin değil; müdür inceler.",
    confidence: 0.41,
    possible_duplicate_of: null,
  },
];

type Decision = Schemas["AgentDecisionRead"];

function decision(id: number, fields: Omit<Decision, "id" | "run_id" | "latency_ms" | "created_at">): Decision {
  return { id, run_id: "6f1c2a9e-0000-4000-8000-000000000131", latency_ms: 12, created_at: SAFETY_CASE.created_at, ...fields };
}

// Agent kararlari (GET /cases/{id}/decisions), kosu sirasiyla
export const DECISIONS: Record<number, Decision[]> = {
  131: [
    decision(1, {
      agent_name: "classification",
      decision: "ELECTRICAL_FAULT",
      confidence: 0.91,
      reasons: [{ code: "MODEL_PREDICTION", message: "Model tahmini: Elektrik arızası (%91), Aydınlatma arızası (%6)" }],
      output: {},
      model: "tfidf-logreg@2026.10.1",
    }),
    decision(2, {
      agent_name: "priority",
      decision: "CRITICAL",
      confidence: null,
      reasons: [
        { code: "SAFETY_KEYWORD", message: "‘kıvılcım’ kelimesi → güvenlik", weight: 30 },
        { code: "SAFETY_FLOOR", message: "Metinde güvenlik açısından kritik ifade var; öncelik en az CRITICAL." },
      ],
      output: {},
      model: "rules@1.0",
    }),
    decision(3, {
      agent_name: "routing",
      decision: "ASSIGN_DEPARTMENT",
      confidence: 0.88,
      reasons: [{ code: "NO_AVAILABLE_STAFF", message: "Uygun personel yok; görev birimin havuzuna düşer." }],
      output: {},
      model: "rules@1.0",
    }),
    decision(4, {
      agent_name: "supervisor",
      decision: "ESCALATE",
      confidence: null,
      reasons: [{ code: "RULE_3_ESCALATE", message: "Güvenlik açısından kritik ya da insan kararı gerektiren tür; müdüre iletilir." }],
      output: {},
      model: "rules@1.0",
    }),
  ],
};
