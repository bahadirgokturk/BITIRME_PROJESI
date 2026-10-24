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
import { LIVE_QUERY } from "@/lib/queryClient";
import type {
  AgingRead,
  DepartmentsRead,
  LocationsRead,
  ProcessMapRead,
  ProcessRead,
  RecurringRead,
  ResolutionTimesRead,
  SlaRead,
} from "@/lib/reports";

type Schemas = components["schemas"];

// Ortak filtre (docs/API.md "Analytics"): ?from=&to=[&department_id=]; donem ya da birim degisince
// sorgular yeniden okunur. Birim verilmezse butun birimler.
function rangeQuery(period: SummaryPeriod, departmentId?: number): string {
  const { from, to } = periodRange(period);
  const unit = departmentId === undefined ? "" : `&department_id=${departmentId}`;
  return `from=${from}&to=${to}${unit}`;
}

export function useKpis(period: SummaryPeriod, departmentId?: number) {
  return useQuery({
    queryKey: ["analytics", "kpis", period, departmentId],
    queryFn: () => apiGet<KpisRead>(`/analytics/kpis?${rangeQuery(period, departmentId)}`),
    // Pano acik duran bir ekran; rapor sorgulari ise elle bakilir ve tazelenmez
    ...LIVE_QUERY,
  });
}

export function useTrend(period: SummaryPeriod, departmentId?: number) {
  return useQuery({
    queryKey: ["analytics", "trend", period, departmentId],
    queryFn: () =>
      apiGet<TrendRead>(`/analytics/trend?${rangeQuery(period, departmentId)}&granularity=${granularityFor(period)}`),
  });
}

export function useCategories(period: SummaryPeriod, departmentId?: number) {
  return useQuery({
    queryKey: ["analytics", "categories", period, departmentId],
    queryFn: () => apiGet<CategoriesRead>(`/analytics/categories?${rangeQuery(period, departmentId)}`),
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
function useReport<T>(name: string, path: string, period: SummaryPeriod, departmentId?: number) {
  return useQuery({
    queryKey: ["analytics", name, period, departmentId],
    queryFn: () => apiGet<T>(`${path}?${rangeQuery(period, departmentId)}`),
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
export const useRecurring = (period: SummaryPeriod, departmentId?: number) =>
  useReport<RecurringRead>("recurring", "/analytics/recurring", period, departmentId);
export const useProcess = (period: SummaryPeriod) => useReport<ProcessRead>("process", "/analytics/process", period);
export const useProcessMap = (period: SummaryPeriod) =>
  useReport<ProcessMapRead>("process-map", "/analytics/process-map", period);
export const useAgentMetrics = (period: SummaryPeriod) =>
  useReport<Schemas["AgentMetricsRead"]>("agent-metrics", "/agents/metrics", period);
