// Analitik uclarinin sahte karsiliklari (cevrimdisi mod; gercek API FAZ 6). Gercek backend ?from=&to=
// araligini hesaplar; burada aralik bir haftadan uzunsa aylik ornek veri doner.
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

import {
  CATEGORIES_MONTH,
  CATEGORIES_WEEK,
  KPIS_MONTH,
  KPIS_WEEK,
  SUMMARY_TEXT_MONTH,
  SUMMARY_TEXT_WEEK,
  TREND_MONTH,
  TREND_WEEK,
} from "./analyticsFixtures";
import {
  AGENT_METRICS_MONTH,
  AGENT_METRICS_WEEK,
  AGING,
  DEPARTMENTS_REPORT,
  LOCATIONS_MONTH,
  LOCATIONS_WEEK,
  PROCESS,
  RECURRING,
  RESOLUTION_TIMES,
  SLA_MONTH,
  SLA_WEEK,
} from "./reportFixtures";

type Schemas = components["schemas"];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

function isMonth(request: Request): boolean {
  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  if (!from || !to) {
    return false;
  }
  return (new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY >= WEEK_DAYS;
}

export const analyticsHandlers = [
  http.get(apiUrl("/analytics/kpis"), ({ request }) => HttpResponse.json(isMonth(request) ? KPIS_MONTH : KPIS_WEEK)),

  http.get(apiUrl("/analytics/trend"), ({ request }) =>
    HttpResponse.json(isMonth(request) ? TREND_MONTH : TREND_WEEK),
  ),

  http.get(apiUrl("/analytics/categories"), ({ request }) =>
    HttpResponse.json(isMonth(request) ? CATEGORIES_MONTH : CATEGORIES_WEEK),
  ),

  // Raporlar (/manager/analytics): donemle degisen ornekler konum ve SLA; digerleri sabit
  http.get(apiUrl("/analytics/locations"), ({ request }) =>
    HttpResponse.json(isMonth(request) ? LOCATIONS_MONTH : LOCATIONS_WEEK),
  ),
  http.get(apiUrl("/analytics/sla"), ({ request }) => HttpResponse.json(isMonth(request) ? SLA_MONTH : SLA_WEEK)),
  http.get(apiUrl("/analytics/resolution-times"), () => HttpResponse.json(RESOLUTION_TIMES)),
  http.get(apiUrl("/analytics/aging"), () => HttpResponse.json(AGING)),
  http.get(apiUrl("/analytics/departments"), () => HttpResponse.json(DEPARTMENTS_REPORT)),
  http.get(apiUrl("/analytics/recurring"), () => HttpResponse.json(RECURRING)),
  http.get(apiUrl("/analytics/process"), () => HttpResponse.json(PROCESS)),

  http.get(apiUrl("/agents/metrics"), ({ request }) =>
    HttpResponse.json(isMonth(request) ? AGENT_METRICS_MONTH : AGENT_METRICS_WEEK),
  ),

  http.post<never, Schemas["SummaryRequest"]>(apiUrl("/analytics/summary"), async ({ request }) => {
    const { period } = await request.json();
    const month = period === "30d";
    const body: Schemas["SummaryRead"] = {
      kpis: { period: KPIS_WEEK.period, total_cases: month ? 251 : 64 },
      text: month ? SUMMARY_TEXT_MONTH : SUMMARY_TEXT_WEEK,
      source: "TEMPLATE",
      sentences: [],
    };
    return HttpResponse.json(body);
  }),
];
