import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiRequest } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type AgentPolicy = Schemas["AgentPolicyRead"];

const AGENT_POLICIES_KEY = ["admin", "agent-policies"];
// Backend'in page_size ust siniri; politikalarin hepsi tek istekte gelir
const ADMIN_PAGE_SIZE = 200;

export function useAdminAgentPolicies() {
  return useQuery({
    queryKey: AGENT_POLICIES_KEY,
    queryFn: () => apiGet<Schemas["Page_AgentPolicyRead_"]>(`/admin/agent-policies?page_size=${ADMIN_PAGE_SIZE}`),
    select: (page) => page.items,
  });
}

// PATCH yalniz gonderilen alanlari degistirir (docs/API.md "/admin/agent-policies"); ekleme ve silme yok
export function useUpdateAgentPolicy(policyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["AgentPolicyUpdate"]) =>
      apiRequest<AgentPolicy>(`/admin/agent-policies/${policyId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_POLICIES_KEY }),
  });
}
