// Mudurun bildirim detay ekrani (/manager/cases/[id]) icin sahte veriler: yapay zeka kararlari,
// mudurun gordugu ayrintili olaylar ve fotograflar. Bicimler gercek backend cevaplarindan alindi.
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type CaseRead = Schemas["CaseRead"];
type Decision = Schemas["AgentDecisionRead"];
type Event = Schemas["CaseEventRead"];
type Attachment = Schemas["AttachmentRead"];

// "Tum Bildirimler" listesinin ilk kaydi (managerCaseFixtures.ts): kendiliginden atanan sabun bildirimi
export const AUTO_CASE_ID = 301;
const RUN_ID = "6f1c2a9e-0000-4000-8000-000000000301";
const RULES = "rules@1.0";

type DecisionFields = Pick<Decision, "agent_name" | "agent_label" | "decision" | "decision_label"> &
  Partial<Pick<Decision, "confidence" | "reasons" | "model">>;

function decision(id: number, fields: DecisionFields): Decision {
  return {
    id,
    run_id: RUN_ID,
    confidence: null,
    reasons: [],
    output: {},
    model: RULES,
    latency_ms: 12,
    created_at: "2026-10-13T07:42:00Z",
    ...fields,
  };
}

// Kosu sirasiyla (GET /cases/{id}/decisions)
const AUTO_DECISIONS: Decision[] = [
  decision(1, { agent_name: "intake", agent_label: "Ön inceleme", decision: "PARSED", decision_label: "Anlaşılır" }),
  decision(2, {
    agent_name: "classification",
    agent_label: "Sınıflandırma",
    decision: "SOAP_EMPTY",
    decision_label: "Sabun bitti",
    confidence: 0.94,
    reasons: [{ code: "MODEL_PREDICTION", weight: null, message: "Model tahmini: Sabun bitti (%94)" }],
    model: "tfidf-logreg@1.0",
  }),
  decision(3, {
    agent_name: "duplicate",
    agent_label: "Tekrar kontrolü",
    decision: "NEW_CASE",
    decision_label: "Yeni sorun",
    reasons: [{ code: "NO_SIMILAR_CASE", weight: null, message: "Yakında benzer açık bildirim yok." }],
    model: "char-tf-cosine@1.0",
  }),
  decision(4, {
    agent_name: "priority",
    agent_label: "Öncelik",
    decision: "LOW",
    decision_label: "Düşük",
    reasons: [
      { code: "TYPE_SEVERITY", weight: 8, message: "Bildirim türünün ciddiyeti" },
      { code: "LOCATION_IMPORTANCE", weight: 8, message: "Konumun önemi (yoğunluk, hijyen)" },
    ],
  }),
  decision(5, {
    agent_name: "routing",
    agent_label: "Yönlendirme",
    decision: "ASSIGN_STAFF",
    decision_label: "Personel seçildi",
    reasons: [
      { code: "STAFF_SCORE", weight: null, message: "En az iş yükü, aynı bina ve bu işteki tecrübeye göre seçildi." },
    ],
  }),
  decision(6, {
    agent_name: "supervisor",
    agent_label: "Karar",
    decision: "AUTO_ASSIGN",
    decision_label: "Görev personele atandı",
    reasons: [{ code: "RULE_AUTO_ASSIGN", weight: null, message: "Tür ve birim kesin; görev kendiliğinden açıldı." }],
  }),
];

export const MANAGER_DECISIONS: Record<number, Decision[]> = { [AUTO_CASE_ID]: AUTO_DECISIONS };

type EventFields = Pick<Event, "event_type"> & Partial<Event>;

// Mudur butun olaylari gorur (bildiren yalniz bir kismini); yapay zeka adimlari adim adiyla gelir
function steps(item: CaseRead): EventFields[] {
  const analysed: EventFields[] = [
    { event_type: "CASE_CREATED", actor_type: "USER", actor_id: item.reporter_id, to_status: "NEW" },
    { event_type: "ANALYSIS_STARTED", from_status: "NEW", to_status: "ANALYZING" },
  ];
  if (!item.case_type) {
    return analysed;
  }
  const classified: EventFields[] = [
    ...analysed,
    {
      event_type: "AI_CLASSIFIED",
      actor_type: "AGENT",
      agent_name: "classification",
      metadata: { case_type: item.case_type.code },
    },
    { event_type: "ROUTED", actor_type: "AGENT", agent_name: "routing" },
  ];
  const last: EventFields =
    item.status === "ESCALATED"
      ? { event_type: "ESCALATED", actor_type: "AGENT", agent_name: "supervisor", to_status: "ESCALATED" }
      : { event_type: "TASK_CREATED", actor_type: "AGENT", agent_name: "routing", to_status: "ASSIGNED" };
  return [...classified, last];
}

const EVENT_ID_STEP = 100;

export function managerEventsFor(item: CaseRead): Event[] {
  return steps(item).map((fields, index) => ({
    id: item.id * EVENT_ID_STEP + index,
    actor_type: "SYSTEM",
    actor_id: null,
    agent_name: null,
    from_status: null,
    to_status: null,
    occurred_at: item.created_at,
    metadata: {},
    ...fields,
  }));
}

// Bildirenin ekledigi fotograf (kind REPORT)
export const MANAGER_CASE_PHOTOS: Attachment[] = [
  {
    id: 801,
    case_id: AUTO_CASE_ID,
    kind: "REPORT",
    original_name: "sabunluk.jpg",
    mime_type: "image/jpeg",
    size_bytes: 48_000,
    uploaded_by: 900,
    created_at: "2026-10-13T07:42:00Z",
    url: "/api/v1/attachments/801",
  },
];
