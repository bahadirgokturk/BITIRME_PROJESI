// Sahte gorevler: personel ekranlari (/staff/tasks, /staff/tasks/[id]) icin farkli durum ve SLA ornekleri.
// Birim kodlari docs/DEPARTMENTS.md ile ayni; sahte personel USERS.STAFF (Destek Hizmetleri).
import type { components } from "@/lib/api/types";

import { USERS } from "./fixtures";

type Task = components["schemas"]["TaskRead"];

const SUPPORT = { id: 1, code: "SUPPORT_SERVICES", name: "Destek Hizmetleri Şube Müdürlüğü" };
const WC = { id: 4, kind: "WC", name: "B Blok 2. Kat Erkek WC", path: "KMP/B/B-2/B-2-WCM" } as const;
const AMFI = { id: 5, kind: "ROOM", name: "B201 Amfi", path: "KMP/B/B-2/B-201" } as const;

const BASE: Omit<Task, "id" | "case_id" | "case_number" | "title" | "description" | "location"> = {
  status: "PENDING",
  department: SUPPORT,
  assigned_user_id: USERS.STAFF.id,
  priority: "LOW",
  created_at: "2026-09-27T08:16:00Z",
  accepted_at: null,
  started_at: null,
  completed_at: null,
  completion_note: null,
  declined_reason: null,
  due_at: null,
  sla_status: null,
};

export const TASKS: Task[] = [
  {
    ...BASE,
    id: 201,
    case_id: 101,
    case_number: "CASE-000101",
    title: "Tuvalette sabun bitmiş",
    description: "B Blok 2. kat erkek tuvaletinde sabunluklar boş.",
    location: WC,
    due_at: "2026-09-27T12:16:00Z",
    sla_status: "AT_RISK",
  },
  {
    ...BASE,
    id: 202,
    case_id: 105,
    case_number: "CASE-000105",
    title: "Amfide çöp kutusu taşmış",
    description: "B201 amfinin arkasındaki çöp kutusu taşmış.",
    location: AMFI,
    due_at: "2026-09-27T16:00:00Z",
    sla_status: "ON_TRACK",
  },
  {
    ...BASE,
    id: 203,
    case_id: 106,
    case_number: "CASE-000106",
    title: "Koridorda su birikintisi",
    description: "Tuvaletin önünde su birikmiş, kayma tehlikesi var.",
    location: WC,
    status: "IN_PROGRESS",
    priority: "HIGH",
    accepted_at: "2026-09-27T07:05:00Z",
    started_at: "2026-09-27T07:10:00Z",
    due_at: "2026-09-27T07:30:00Z",
    sla_status: "BREACHED",
  },
  {
    ...BASE,
    id: 204,
    case_id: 107,
    case_number: "CASE-000107",
    title: "Amfide kâğıt havlu yok",
    description: "B201 amfinin yanındaki lavaboda kâğıt havlu kalmamış.",
    location: AMFI,
    status: "ACCEPTED",
    accepted_at: "2026-09-27T09:00:00Z",
  },
];
