import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { components } from "@/lib/api/types";
import { caseListQuery, type CaseFilters } from "@/lib/caseList";
import { nextPage } from "@/lib/pagination";

export type CaseRead = components["schemas"]["CaseRead"];
export type CaseEventRead = components["schemas"]["CaseEventRead"];
type CasePage = components["schemas"]["Page_CaseRead_"];

// Backend varsayilani ile ayni (backend/app/core/constants.py PAGE_SIZE_DEFAULT)
const MY_CASES_PAGE_SIZE = 20;

// Bildirim yapanin kendi bildirimleri, sayfa sayfa (docs/API.md "Cases"); data tum yuklenen kayitlar
export function useMyCases() {
  return useInfiniteQuery({
    queryKey: ["cases", "mine"],
    queryFn: ({ pageParam }) =>
      apiGet<CasePage>(`/cases/mine?page=${pageParam}&page_size=${MY_CASES_PAGE_SIZE}`),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}

// Kapsam disi ya da olmayan kayit backend'den 404 doner (IDOR); ekran ikisini ayirt etmez
export function useCase(caseId: string) {
  return useQuery({
    queryKey: ["cases", caseId],
    queryFn: () => apiGet<CaseRead>(`/cases/${encodeURIComponent(caseId)}`),
  });
}

export function useCaseEvents(caseId: string) {
  return useQuery({
    queryKey: ["cases", caseId, "events"],
    queryFn: () => apiGet<CaseEventRead[]>(`/cases/${encodeURIComponent(caseId)}/events`),
  });
}

// Mudurun tum bildirimleri, suzgeclerle ve sayfa sayfa. Suzgec degisince yeni cevap gelene kadar
// eski liste ekranda kalir (iskelete donup titremesin).
export function useCaseList(filters: CaseFilters) {
  return useInfiniteQuery({
    queryKey: ["cases", "list", filters],
    queryFn: ({ pageParam }) => apiGet<CasePage>(`/cases?${caseListQuery(filters, pageParam)}`),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    placeholderData: keepPreviousData,
    select: (data) => ({
      items: data.pages.flatMap((page) => page.items),
      total: data.pages[0]?.total ?? 0,
    }),
  });
}
