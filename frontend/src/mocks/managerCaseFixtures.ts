// Sahte bildirimler: mudurun "Tum Bildirimler" listesi (/manager/cases) icin. Zamanlar "simdi"ye gore
// hesaplanir ki kalan sure rozetleri her acilista anlamli olsun. Konum ve birim adlari gercek backend'deki gibi.
import type { components } from "@/lib/api/types";

import { EMPTY_CASE } from "./caseFixtures";

type Schemas = components["schemas"];
type CaseRead = Schemas["CaseRead"];

const MS_PER_MINUTE = 60_000;
const FIRST_ID = 301;
// Bildirim yapan: bu liste baska kullanicilarin bildirimleridir (/cases/mine'da gorunmez)
const OTHER_REPORTER_ID = 900;

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * MS_PER_MINUTE).toISOString();

const SUPPORT = { id: 1, code: "SUPPORT_SERVICES", name: "Destek Hizmetleri Şube Müdürlüğü" };
const MAINTENANCE = { id: 2, code: "MAINTENANCE", name: "Bakım Onarım ve Peyzaj Şube Müdürlüğü" };
const IT = { id: 3, code: "IT_SUPPORT", name: "Donanım ve Teknik Destek Şube Müdürlüğü" };

const SOAP = { id: 1, code: "SOAP_EMPTY", name: "Sabun bitti" };
const TRASH = { id: 3, code: "TRASH_FULL", name: "Çöp dolu" };
const PROJECTOR = { id: 8, code: "PROJECTOR_FAILURE", name: "Projeksiyon arızası" };
const ELEVATOR = { id: 7, code: "ELEVATOR_FAILURE", name: "Asansör arızası" };
const ELECTRIC = { id: 6, code: "ELECTRICAL_FAILURE", name: "Elektrik arızası" };
const INTERNET = { id: 9, code: "INTERNET_DOWN", name: "İnternet yok" };

interface Sample {
  title: string;
  place: string;
  status: CaseRead["status"];
  case_type?: Schemas["CaseTypeSummary"];
  department?: Schemas["DepartmentSummary"];
  priority?: CaseRead["priority"];
  // Bitis zamanina kalan dakika (eksi: gecikmis) ve backend'in hesapladigi SLA durumu
  dueIn?: number;
  sla?: CaseRead["sla_status"];
}

const SAMPLES: Sample[] = [
  { title: "B Blok Zemin Kat WC'de sabun bitmiş", place: "B Blok Zemin Kat WC", status: "ASSIGNED", case_type: SOAP, department: SUPPORT, priority: "LOW", dueIn: 80, sla: "ON_TRACK" },
  { title: "A-101 Amfi'de projeksiyon açılmıyor", place: "A-101 Amfi", status: "IN_PROGRESS", case_type: PROJECTOR, department: MAINTENANCE, priority: "HIGH", dueIn: 40, sla: "AT_RISK" },
  { title: "Asansör katlar arasında kaldı", place: "A Blok Asansör", status: "ESCALATED", case_type: ELEVATOR, department: MAINTENANCE, priority: "CRITICAL", dueIn: -25, sla: "BREACHED" },
  { title: "Yemekhane salonunda çöpler taşmış", place: "Yemekhane Salonu", status: "ACCEPTED", case_type: TRASH, department: SUPPORT, priority: "MEDIUM", dueIn: 180, sla: "ON_TRACK" },
  { title: "Kütüphanede internet yok", place: "B Blok Kütüphane", status: "NEEDS_INFO", case_type: INTERNET, department: IT, priority: "HIGH" },
  { title: "Otoparkta aydınlatma yanmıyor", place: "Otopark", status: "CLOSED", case_type: ELECTRIC, department: MAINTENANCE, priority: "MEDIUM" },
  { title: "A Blok 1. Kat Erkek WC'de sabun yok", place: "A Blok 1. Kat Erkek WC", status: "MERGED", case_type: SOAP, department: SUPPORT, priority: "LOW" },
  { title: "Kantin fiyat listesi hakkında", place: "Kantin", status: "REJECTED" },
];

const REPEAT = 3;
const MINUTES_BETWEEN_CASES = 47;
const CASE_NUMBER_DIGITS = 6;

function build(sample: Sample, index: number): CaseRead {
  const id = FIRST_ID + index;
  const round = Math.floor(index / SAMPLES.length);
  return {
    ...EMPTY_CASE,
    id,
    case_number: `CASE-${String(id).padStart(CASE_NUMBER_DIGITS, "0")}`,
    // Tekrarlanan ornekler ayirt edilsin diye sonraki turlarda basliga sira eklenir
    title: round === 0 ? sample.title : `${sample.title} (${round + 1})`,
    description: sample.title,
    location: { id: 500 + (index % SAMPLES.length), kind: "ROOM", name: sample.place, path: `KMP/${index % SAMPLES.length}` },
    reporter_id: OTHER_REPORTER_ID,
    status: sample.status,
    case_type: sample.case_type ?? null,
    department: sample.department ?? null,
    priority: sample.priority ?? null,
    created_at: minutesFromNow(-(index + 1) * MINUTES_BETWEEN_CASES),
    due_at: sample.dueIn === undefined ? null : minutesFromNow(sample.dueIn),
    sla_status: sample.sla ?? null,
  };
}

// 24 bildirim: ilk sayfa (20) dolar, "Daha fazla goster" denenebilir. En yeni en ustte.
export const MANAGER_CASES: CaseRead[] = Array.from({ length: REPEAT }, () => SAMPLES)
  .flat()
  .map(build);
