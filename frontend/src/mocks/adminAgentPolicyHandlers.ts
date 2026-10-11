// Yonetim > Yapay Zeka Politikalari endpoint'lerinin sahte karsiliklari (cevrimdisi mod; gercek API E2-3).
// Tur basina bir politika vardir; ekleme ve silme yoktur (docs/API.md "/admin/agent-policies").
import { http, HttpResponse } from "msw";

import { apiUrl } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Schemas = components["schemas"];
type AgentPolicy = Schemas["AgentPolicyRead"];
type Autonomy = AgentPolicy["autonomy_level"];

// backend/app/core/constants.py MIN_CONFIDENCE_AUTO_DEFAULT
const CONFIDENCE_DEFAULT = 0.7;

function policy(caseTypeId: number, autonomy_level: Autonomy, notify_manager: boolean): AgentPolicy {
  return {
    id: caseTypeId,
    scope: "CASE_TYPE",
    case_type_id: caseTypeId,
    category: null,
    autonomy_level,
    min_confidence_auto: CONFIDENCE_DEFAULT,
    notify_manager,
    is_active: true,
  };
}

// Tur numaralari adminCaseTypeHandlers.ts ile ayni; seviyeler docs/AGENTS.md bolum 5'ten
const AGENT_POLICIES: AgentPolicy[] = [
  policy(1, "L1_AUTONOMOUS", false),
  policy(2, "L1_AUTONOMOUS", false),
  policy(3, "L3_ESCALATE", true),
  policy(4, "L2_NOTIFY", true),
  policy(5, "L1_AUTONOMOUS", false),
  policy(6, "L1_AUTONOMOUS", false),
];

let policies: AgentPolicy[] = [];

// Testler her seferinde ayni listeyle baslar
export function resetAdminAgentPolicies(): void {
  policies = structuredClone(AGENT_POLICIES);
}
resetAdminAgentPolicies();

export const adminAgentPolicyHandlers = [
  http.get(apiUrl("/admin/agent-policies"), () =>
    HttpResponse.json({ items: policies, total: policies.length, page: 1 }),
  ),

  http.patch<{ id: string }, Schemas["AgentPolicyUpdate"]>(
    apiUrl("/admin/agent-policies/:id"),
    async ({ request, params }) => {
      const id = Number(params.id);
      const current = policies.find((item) => item.id === id);
      if (!current) {
        const body: Schemas["ErrorRead"] = { error: { code: "NOT_FOUND", message: "Kayıt bulunamadı.", details: {} } };
        return HttpResponse.json(body, { status: 404 });
      }
      const body = await request.json();
      const updated: AgentPolicy = {
        ...current,
        autonomy_level: body.autonomy_level ?? current.autonomy_level,
        min_confidence_auto: body.min_confidence_auto ?? current.min_confidence_auto,
        notify_manager: body.notify_manager ?? current.notify_manager,
      };
      policies = policies.map((item) => (item.id === id ? updated : item));
      return HttpResponse.json(updated);
    },
  ),
];
