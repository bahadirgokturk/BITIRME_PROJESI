// Sahte analitik verisi: mudur ekranlari (/manager/dashboard) icin. Sekiller backend sozlesmesiyle ayni
// (backend/app/schemas/analytics.py); sureler dakika, oranlar yuzde, veri yoksa null.
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type KpiValue = Schemas["KpiValue"];

const kpi = (value: number | null, previous: number | null = null, delta_pct: number | null = null): KpiValue => ({
  value,
  previous,
  delta_pct,
});

const PERIOD = { from: "2026-10-01", to: "2026-10-07" };

export const KPIS_WEEK: Schemas["KpisRead"] = {
  period: PERIOD,
  total_cases: kpi(64, 57, 12.3),
  open_cases: kpi(42, 37.5, 12),
  closed_cases: kpi(58, 55, 5.5),
  cases_today: kpi(9, 10, -10),
  avg_resolution_min: kpi(310, 337, -8),
  median_resolution_min: kpi(240, 250, -4),
  median_first_response_min: kpi(18, 20, -10),
  median_assignment_min: kpi(6, 6, 0),
  sla_compliance_pct: kpi(91, 88.3, 3),
  sla_breach_pct: kpi(9, 11.7, -23),
  reopen_pct: kpi(4, 5, -20),
  automation_pct: kpi(78, 74.3, 5),
  human_review_pct: kpi(14),
};

export const KPIS_MONTH: Schemas["KpisRead"] = {
  ...KPIS_WEEK,
  total_cases: kpi(251, 230, 9.1),
  open_cases: kpi(42, 40, 5),
  closed_cases: kpi(236, 221, 6.8),
  avg_resolution_min: kpi(345, 360, -4.2),
  sla_compliance_pct: kpi(89, 90, -1.1),
  automation_pct: kpi(76, 70, 8.6),
  human_review_pct: kpi(16, 19, -15.8),
};

const empty = kpi(null);
const zero = kpi(0);

// Secilen donemde hic bildirim yok (bos durum)
export const KPIS_EMPTY: Schemas["KpisRead"] = {
  period: PERIOD,
  total_cases: zero,
  open_cases: zero,
  closed_cases: zero,
  cases_today: zero,
  avg_resolution_min: empty,
  median_resolution_min: empty,
  median_first_response_min: empty,
  median_assignment_min: empty,
  sla_compliance_pct: empty,
  sla_breach_pct: empty,
  reopen_pct: empty,
  automation_pct: empty,
  human_review_pct: empty,
};

// 5 Ekim 2026 Pazartesi ile baslayan hafta
export const TREND_WEEK: Schemas["TrendRead"] = {
  granularity: "day",
  points: [
    { bucket: "2026-10-05", opened: 8, closed: 6 },
    { bucket: "2026-10-06", opened: 11, closed: 9 },
    { bucket: "2026-10-07", opened: 9, closed: 10 },
    { bucket: "2026-10-08", opened: 14, closed: 12 },
    { bucket: "2026-10-09", opened: 10, closed: 11 },
    { bucket: "2026-10-10", opened: 7, closed: 6 },
    { bucket: "2026-10-11", opened: 5, closed: 4 },
  ],
};

export const TREND_MONTH: Schemas["TrendRead"] = {
  granularity: "week",
  points: [
    { bucket: "2026-09-14", opened: 58, closed: 52 },
    { bucket: "2026-09-21", opened: 66, closed: 61 },
    { bucket: "2026-09-28", opened: 63, closed: 65 },
    { bucket: "2026-10-05", opened: 64, closed: 58 },
  ],
};

export const CATEGORIES_WEEK: Schemas["CategoriesRead"] = {
  total: 64,
  items: [
    { category: "CLEANING", label: "Temizlik", count: 26, case_types: [] },
    { category: "TECHNICAL", label: "Teknik arıza", count: 15, case_types: [] },
    { category: "IT", label: "Bilgi işlem", count: 11, case_types: [] },
    { category: "SECURITY", label: "Güvenlik", count: 7, case_types: [] },
    { category: "OTHER", label: "Diğer", count: 5, case_types: [] },
  ],
};

export const CATEGORIES_MONTH: Schemas["CategoriesRead"] = {
  total: 251,
  items: [
    { category: "CLEANING", label: "Temizlik", count: 96, case_types: [] },
    { category: "TECHNICAL", label: "Teknik arıza", count: 64, case_types: [] },
    { category: "IT", label: "Bilgi işlem", count: 48, case_types: [] },
    { category: "SECURITY", label: "Güvenlik", count: 22, case_types: [] },
    { category: "OTHER", label: "Diğer", count: 21, case_types: [] },
  ],
};

export const SUMMARY_TEXT_WEEK =
  "Son 7 günde 64 bildirim açıldı; önceki haftaya göre %12 artış var. SLA uyumu %91. " +
  "Bildirimlerin %78'i kimse dokunmadan doğru personele atandı. En çok sorun Temizlik kategorisinde ve " +
  "B Blok'ta görüldü; B Blok 2. Kat Erkek WC'de sabun bildirimi 17 kez tekrarlandı, kalıcı çözüm değerlendirilebilir.";

export const SUMMARY_TEXT_MONTH =
  "Son 30 günde 251 bildirim açıldı; önceki döneme göre %9 artış var. SLA uyumu %89. " +
  "Bildirimlerin %76'sı kimse dokunmadan doğru personele atandı. En çok sorun Temizlik kategorisinde görüldü.";
