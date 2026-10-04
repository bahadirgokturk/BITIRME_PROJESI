import { useQuery } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import {
  granularityFor,
  periodRange,
  type CategoriesRead,
  type KpisRead,
  type SummaryPeriod,
  type TrendRead,
} from "@/lib/analytics";

type Schemas = components["schemas"];

// Ortak filtre (docs/API.md "Analytics"): ?from=&to=; donem degisince uc sorgu da yeniden okunur
function rangeQuery(period: SummaryPeriod): string {
  const { from, to } = periodRange(period);
  return `from=${from}&to=${to}`;
}

export function useKpis(period: SummaryPeriod) {
  return useQuery({
    queryKey: ["analytics", "kpis", period],
    queryFn: () => apiGet<KpisRead>(`/analytics/kpis?${rangeQuery(period)}`),
  });
}

export function useTrend(period: SummaryPeriod) {
  return useQuery({
    queryKey: ["analytics", "trend", period],
    queryFn: () =>
      apiGet<TrendRead>(`/analytics/trend?${rangeQuery(period)}&granularity=${granularityFor(period)}`),
  });
}

export function useCategories(period: SummaryPeriod) {
  return useQuery({
    queryKey: ["analytics", "categories", period],
    queryFn: () => apiGet<CategoriesRead>(`/analytics/categories?${rangeQuery(period)}`),
  });
}

// AI yonetim ozeti POST ile uretilir ama ekran icin bir okuma gibidir: donem basina bir kez istenir,
// "Yeniden olustur" ayni sorguyu tazeler. enabled=false iken (bos donem) hic istenmez.
export function useSummary(period: SummaryPeriod, enabled: boolean) {
  return useQuery({
    queryKey: ["analytics", "summary", period],
    queryFn: () => {
      const body: Schemas["SummaryRequest"] = { period };
      return apiPost<Schemas["SummaryRead"]>("/analytics/summary", body);
    },
    enabled,
    staleTime: Infinity,
  });
}
