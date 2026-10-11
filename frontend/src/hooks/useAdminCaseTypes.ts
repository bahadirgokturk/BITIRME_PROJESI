import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type CaseType = Schemas["CaseTypeAdminRead"];

const CASE_TYPES_KEY = ["admin", "case-types"];
// Backend'in page_size ust siniri; turlerin hepsi tek istekte gelir
const ADMIN_PAGE_SIZE = 200;

export function useAdminCaseTypes() {
  return useQuery({
    queryKey: CASE_TYPES_KEY,
    queryFn: () => apiGet<Schemas["Page_CaseTypeAdminRead_"]>(`/admin/case-types?page_size=${ADMIN_PAGE_SIZE}`),
    select: (page) => page.items,
  });
}

// Mudurun "Duzelt" penceresindeki tur sozlugu oturum boyunca saklanir (useReview.ts); tur degisince o da yenilenir
function useRefreshCaseTypes() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CASE_TYPES_KEY }),
      queryClient.invalidateQueries({ queryKey: ["lookups", "case-types"] }),
    ]);
}

export function useCreateCaseType() {
  const refresh = useRefreshCaseTypes();
  return useMutation({
    mutationFn: (body: Schemas["CaseTypeCreate"]) => apiPost<CaseType>("/admin/case-types", body),
    onSuccess: refresh,
  });
}

// PATCH yalniz gonderilen alanlari degistirir (docs/API.md "/admin/case-types"); kod degistirilemez
export function useUpdateCaseType(caseTypeId: number) {
  const refresh = useRefreshCaseTypes();
  return useMutation({
    mutationFn: (body: Schemas["CaseTypeUpdate"]) =>
      apiRequest<CaseType>(`/admin/case-types/${caseTypeId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: refresh,
  });
}
