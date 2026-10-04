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
import type {
  AgingRead,
  DepartmentsRead,
  LocationsRead,
  ProcessRead,
  RecurringRead,
  ResolutionTimesRead,
  SlaRead,
} from "@/lib/reports";

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

// Raporlar ekraninin sorgulari ayni kalipta: donem araligiyla tek bir GET
function useReport<T>(name: string, path: string, period: SummaryPeriod) {
  return useQuery({
    queryKey: ["analytics", name, period],
    queryFn: () => apiGet<T>(`${path}?${rangeQuery(period)}`),
  });
}

export const useLocations = (period: SummaryPeriod) =>
  useReport<LocationsRead>("locations", "/analytics/locations", period);
export const useResolutionTimes = (period: SummaryPeriod) =>
  useReport<ResolutionTimesRead>("resolution-times", "/analytics/resolution-times", period);
export const useSla = (period: SummaryPeriod) => useReport<SlaRead>("sla", "/analytics/sla", period);
export const useAging = (period: SummaryPeriod) => useReport<AgingRead>("aging", "/analytics/aging", period);
export const useDepartments = (period: SummaryPeriod) =>
  useReport<DepartmentsRead>("departments", "/analytics/departments", period);
export const useRecurring = (period: SummaryPeriod) =>
  useReport<RecurringRead>("recurring", "/analytics/recurring", period);
export const useProcess = (period: SummaryPeriod) => useReport<ProcessRead>("process", "/analytics/process", period);
export const useAgentMetrics = (period: SummaryPeriod) =>
  useReport<Schemas["AgentMetricsRead"]>("agent-metrics", "/agents/metrics", period);
