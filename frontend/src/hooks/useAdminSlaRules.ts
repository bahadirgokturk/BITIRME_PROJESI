import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type SlaRule = Schemas["SlaRuleRead"];

const SLA_RULES_KEY = ["admin", "sla-rules"];
// Backend'in page_size ust siniri; kurallarin hepsi tek istekte gelir
const ADMIN_PAGE_SIZE = 200;

export function useAdminSlaRules() {
  return useQuery({
    queryKey: SLA_RULES_KEY,
    queryFn: () => apiGet<Schemas["Page_SlaRuleRead_"]>(`/admin/sla-rules?page_size=${ADMIN_PAGE_SIZE}`),
    select: (page) => page.items,
  });
}

export function useCreateSlaRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["SlaRuleCreate"]) => apiPost<SlaRule>("/admin/sla-rules", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SLA_RULES_KEY }),
  });
}

// PATCH yalniz gonderilen alanlari degistirir (docs/API.md "/admin/sla-rules"); tur ve oncelik degistirilemez
export function useUpdateSlaRule(ruleId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["SlaRuleUpdate"]) =>
      apiRequest<SlaRule>(`/admin/sla-rules/${ruleId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SLA_RULES_KEY }),
  });
}
