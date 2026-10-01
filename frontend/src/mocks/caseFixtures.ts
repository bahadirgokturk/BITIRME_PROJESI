// Sahte bildirimler: bildirim yapan ekranlari (/report, /my-cases, /cases/[id]) icin farkli durumlarda ornekler.
// Birim ve tur kodlari docs/DEPARTMENTS.md ile ayni.
import type { components } from "@/lib/api/types";

import { USERS } from "./fixtures";

type Schemas = components["schemas"];

const REPORTER_ID = USERS.REPORTER.id;

// Puan ve yeniden acma kutulari son kapanistan sonraki 72 saatte gorunur: ornek bildirim "az once kapanmis" olur
const MS_PER_HOUR = 3_600_000;
const CLOSED_HOURS_AGO = 2;
const RECENTLY_CLOSED_AT = new Date(Date.now() - CLOSED_HOURS_AGO * MS_PER_HOUR).toISOString();

const WC = {
  id: 4,
  kind: "WC",
  name: "B Blok 2. Kat Erkek WC",
  path: "KMP/B/B-2/B-2-WCM",
} as const;
const AMFI = {
  id: 5,
  kind: "ROOM",
  name: "B201 Amfi",
  path: "KMP/B/B-2/B-201",
} as const;

const SUPPORT = {
  id: 1,
  code: "SUPPORT_SERVICES",
  name: "Destek Hizmetleri Şube Müdürlüğü",
};
const MAINTENANCE = {
  id: 2,
  code: "MAINTENANCE",
  name: "Bakım Onarım ve Peyzaj Şube Müdürlüğü",
};

// Yeni ve henuz analiz edilmemis bildirimin alanlari
export const EMPTY_CASE: Omit<
  Schemas["CaseRead"],
  "id" | "case_number" | "title" | "description" | "location"
> = {
  status: "ANALYZING",
  reporter_id: REPORTER_ID,
  case_type: null,
  category: null,
  department: null,
  priority: null,
  needs_human_review: false,
  reopened_count: 0,
  satisfaction_rating: null,
  info_request: null,
  created_at: "2026-09-27T08:15:00Z",
  assigned_at: null,
  resolved_at: null,
  closed_at: null,
  due_at: null,
};

export const CASES: Schemas["CaseRead"][] = [
  {
    ...EMPTY_CASE,
    id: 101,
    case_number: "CASE-000101",
    title: "Tuvalette sabun bitmiş",
    description: "B Blok 2. kat erkek tuvaletinde sabunluklar boş.",
    location: WC,
    status: "ASSIGNED",
    case_type: { id: 1, code: "SOAP_EMPTY", name: "Sabun bitti" },
    category: "CONSUMABLE",
    department: SUPPORT,
    priority: "LOW",
    assigned_at: "2026-09-27T08:16:00Z",
    due_at: "2026-09-27T12:16:00Z",
  },
  {
    ...EMPTY_CASE,
    id: 102,
    case_number: "CASE-000102",
    title: "Amfide projeksiyon çalışmıyor",
    description: "B201 amfideki projeksiyon açılmıyor, ders başlamak üzere.",
    location: AMFI,
    status: "IN_PROGRESS",
    case_type: {
      id: 15,
      code: "PROJECTOR_FAILURE",
      name: "Projeksiyon arızası",
    },
    category: "TECHNICAL",
    department: MAINTENANCE,
    priority: "MEDIUM",
    created_at: "2026-09-26T09:00:00Z",
    assigned_at: "2026-09-26T09:02:00Z",
    due_at: "2026-09-26T17:02:00Z",
  },
  {
    ...EMPTY_CASE,
    id: 103,
    case_number: "CASE-000103",
    title: "Çöp kutusu taşmış",
    description: "Tuvaletin girişindeki çöp kutusu taşmış, etrafa dağılmış.",
    location: WC,
    status: "CLOSED",
    case_type: { id: 3, code: "TRASH_FULL", name: "Çöp dolu" },
    category: "CLEANING",
    department: SUPPORT,
    priority: "LOW",
    created_at: "2026-09-25T14:00:00Z",
    assigned_at: "2026-09-25T14:01:00Z",
    resolved_at: "2026-09-25T14:40:00Z",
    closed_at: RECENTLY_CLOSED_AT,
  },
  {
    ...EMPTY_CASE,
    id: 104,
    case_number: "CASE-000104",
    title: "Amfide garip bir koku var",
    description:
      "B201 amfide yanık kokusu gibi bir koku var, nereden geldiği belli değil.",
    location: AMFI,
    status: "NEEDS_INFO",
    info_request:
      "Kokuyu en çok amfinin hangi tarafında hissediyorsunuz? Prizlerin yakınında mı?",
    needs_human_review: true,
    created_at: "2026-09-27T09:30:00Z",
  },
];

type Event = Schemas["CaseEventRead"];

function event(
  id: number,
  fields: Partial<Event> & Pick<Event, "event_type" | "occurred_at">,
): Event {
  return {
    id,
    actor_type: "SYSTEM",
    actor_id: null,
    agent_name: null,
    from_status: null,
    to_status: null,
    metadata: {},
    ...fields,
  };
}

// Analizden sonraki ilk adim: soru sorulduysa INFO_REQUESTED, tur belirlendiyse AI_CLASSIFIED
function afterAnalysis(item: Schemas["CaseRead"], id: number): Event[] {
  if (item.status === "NEEDS_INFO") {
    return [
      event(id, {
        event_type: "INFO_REQUESTED",
        actor_type: "USER",
        from_status: "ANALYZING",
        to_status: "NEEDS_INFO",
        occurred_at: item.created_at,
      }),
    ];
  }
  if (!item.case_type) {
    return [];
  }
  return [
    event(id, {
      event_type: "AI_CLASSIFIED",
      actor_type: "AGENT",
      agent_name: "classification",
      from_status: "ANALYZING",
      to_status: "CLASSIFIED",
      occurred_at: item.created_at,
    }),
  ];
}

// Reporter'a gosterilen zaman cizelgesi: backend ile ayni olaylar (REPORTER_VISIBLE_EVENTS),
// metadata reporter'a hep bos doner (backend/app/services/case_service.py)
export function timelineFor(item: Schemas["CaseRead"]): Event[] {
  const base = item.id * 10;
  return [
    event(base, {
      event_type: "CASE_CREATED",
      actor_type: "USER",
      actor_id: item.reporter_id,
      to_status: "NEW",
      occurred_at: item.created_at,
    }),
    event(base + 1, {
      event_type: "ANALYSIS_STARTED",
      from_status: "NEW",
      to_status: "ANALYZING",
      occurred_at: item.created_at,
    }),
    ...afterAnalysis(item, base + 2),
  ];
}
