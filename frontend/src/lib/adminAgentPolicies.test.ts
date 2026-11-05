import { describe, expect, it } from "vitest";

import {
  agentPolicyFormProblems,
  agentPolicyRows,
  filterAgentPolicies,
  formatConfidence,
  formFromAgentPolicy,
  NO_AGENT_POLICY_FILTERS,
  toAgentPolicyBody,
  type AgentPolicy,
} from "./adminAgentPolicies";

function policy(overrides: Partial<AgentPolicy>): AgentPolicy {
  return {
    id: 1,
    scope: "CASE_TYPE",
    case_type_id: 1,
    category: null,
    autonomy_level: "L1_AUTONOMOUS",
    min_confidence_auto: 0.7,
    is_active: true,
    ...overrides,
  };
}

const TYPES = [
  { id: 1, name: "Sabun bitti", code: "SOAP_EMPTY" },
  { id: 3, name: "Elektrik arızası", code: "ELECTRICAL_FAILURE" },
];
const POLICIES = [
  policy({ id: 1, case_type_id: 1 }),
  policy({ id: 2, case_type_id: 3, autonomy_level: "L3_ESCALATE" }),
  policy({ id: 3, scope: "CATEGORY", case_type_id: null, category: "CLEANING", autonomy_level: "L2_NOTIFY" }),
];

describe("agentPolicyRows", () => {
  it("names each policy by its type, or by its category, sorted by name", () => {
    const rows = agentPolicyRows(POLICIES, TYPES);

    expect(rows.map((row) => [row.name, row.code])).toEqual([
      ["Elektrik arızası", "ELECTRICAL_FAILURE"],
      ["Sabun bitti", "SOAP_EMPTY"],
      ["Temizlik kategorisi", null],
    ]);
  });

  it("still shows a policy whose type is not in the list yet", () => {
    expect(agentPolicyRows([policy({ case_type_id: 99 })], undefined)[0]?.name).toBe("–");
  });
});

describe("filterAgentPolicies", () => {
  const rows = agentPolicyRows(POLICIES, TYPES);
  const ids = (filters: Partial<typeof NO_AGENT_POLICY_FILTERS>) =>
    filterAgentPolicies(rows, { ...NO_AGENT_POLICY_FILTERS, ...filters }).map((row) => row.policy.id);

  it("searches the type name and the code", () => {
    expect(ids({ search: "ELEKTRİK" })).toEqual([2]);
    expect(ids({ search: "soap empty" })).toEqual([1]);
  });

  it("filters by autonomy level", () => {
    expect(ids({ autonomy: "L3_ESCALATE" })).toEqual([2]);
    expect(ids({})).toHaveLength(3);
  });
});

describe("confidence threshold", () => {
  it.each([
    [0.7, "%70"],
    [0.75, "%75"],
    [0.855, "%86"],
    [1, "%100"],
  ])("shows %f as %s", (value, text) => {
    expect(formatConfidence(value)).toBe(text);
  });

  it("fills the form in percent and sends a 0-1 value back", () => {
    const form = formFromAgentPolicy(policy({ min_confidence_auto: 0.65 }));

    // Haber verme seviyeden gelir (#93): ne formda ne govdede ayri bir ayar var
    expect(form).toEqual({ autonomy_level: "L1_AUTONOMOUS", confidence_pct: "65" });
    expect(toAgentPolicyBody({ ...form, autonomy_level: "L2_NOTIFY", confidence_pct: " 80 " })).toEqual({
      autonomy_level: "L2_NOTIFY",
      min_confidence_auto: 0.8,
    });
  });

  it.each(["", "-1", "101", "70.5", "yetmiş"])("rejects %j", (confidence_pct) => {
    const form = { ...formFromAgentPolicy(policy({})), confidence_pct };
    expect(agentPolicyFormProblems(form).confidence_pct).toBe("Güven eşiği 0 ile 100 arasında bir tam sayı olmalı.");
  });

  it.each(["0", "70", "100"])("accepts %j", (confidence_pct) => {
    expect(agentPolicyFormProblems({ ...formFromAgentPolicy(policy({})), confidence_pct })).toEqual({});
  });
});
