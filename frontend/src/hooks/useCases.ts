import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

export type CaseRead = components["schemas"]["CaseRead"];
export type CaseEventRead = components["schemas"]["CaseEventRead"];
type CasePage = components["schemas"]["Page_CaseRead_"];

// Bildirim yapanin kendi bildirimleri (docs/API.md "Cases")
export function useMyCases() {
  return useQuery({
    queryKey: ["cases", "mine"],
    queryFn: () => apiGet<CasePage>("/cases/mine"),
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
