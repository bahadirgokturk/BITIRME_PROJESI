import { describe, expect, it } from "vitest";

import { CASES } from "@/mocks/caseFixtures";

import {
  agentLabel,
  confidencePercent,
  currentOverrideValue,
  decisionReasons,
  decisionTitles,
  OVERRIDE_FIELD_LABELS,
  priorityLabel,
  reviewActions,
  reviewBadge,
} from "./review";

function firstCase() {
  const [first] = CASES;
  if (!first) {
    throw new Error("caseFixtures.ts CASES bos olmamali");
  }
  return first;
}

const base = firstCase();

function item(overrides: Partial<Parameters<typeof reviewBadge>[0]> = {}) {
  return {
    case: { ...base, status: "CLASSIFIED" as const },
    reason_code: "RULE_5_SEND_TO_HUMAN_REVIEW",
    reason: "Sınıflandırma ya da yönlendirme yeterince kesin değil; müdür inceler.",
    confidence: 0.41,
    possible_duplicate_of: null,
    ...overrides,
  };
}

describe("reviewBadge", () => {
  it("marks an escalated case as sent to the manager, in the danger tone", () => {
    expect(reviewBadge(item({ case: { ...base, status: "ESCALATED" } }))).toEqual({
      label: "Yöneticiye iletildi",
      tone: "danger",
    });
  });

  it("marks a possible duplicate", () => {
    const duplicate = item({ possible_duplicate_of: { id: 102, case_number: "CASE-000102", title: "x" } });

    expect(reviewBadge(duplicate).label).toBe("Olası tekrar");
  });

  it("marks finished work waiting for verification", () => {
    expect(reviewBadge(item({ case: { ...base, status: "VERIFICATION" } })).label).toBe("Çözüm doğrulama");
  });

  it("falls back to low confidence for a case the agents were unsure about", () => {
    expect(reviewBadge(item())).toEqual({ label: "Düşük güven", tone: "neutral" });
  });
});

describe("reviewActions", () => {
  it("lets the manager approve, correct and reject a classified case", () => {
    expect(reviewActions(item())).toEqual({ approve: true, close: false, merge: false, override: true, reject: true });
  });

  it("offers merge only when the agents found a similar case", () => {
    const duplicate = item({ possible_duplicate_of: { id: 102, case_number: "CASE-000102", title: "x" } });

    expect(reviewActions(duplicate).merge).toBe(true);
  });

  it("only offers closing for finished work (assign/reject would be 409)", () => {
    expect(reviewActions(item({ case: { ...base, status: "VERIFICATION" } }))).toEqual({
      approve: false,
      close: true,
      merge: false,
      override: false,
      reject: false,
    });
  });

  it("cannot approve without a suggested department", () => {
    expect(reviewActions(item({ case: { ...base, status: "CLASSIFIED", department: null } })).approve).toBe(false);
  });
});

describe("labels", () => {
  it.each([
    ["classification", "Sınıflandırma"],
    ["priority", "Öncelik"],
    ["routing", "Yönlendirme"],
    ["supervisor", "Karar (Supervisor)"],
    ["something_new", "something_new"],
  ])("names the %s agent", (name, label) => {
    expect(agentLabel(name)).toBe(label);
  });

  it.each([
    ["LOW", "Düşük"],
    ["CRITICAL", "Kritik"],
  ] as const)("names priority %s", (priority, label) => {
    expect(priorityLabel(priority)).toBe(label);
  });

  it("rounds confidence to a whole percent", () => {
    expect(confidencePercent(0.914)).toBe("%91");
    expect(confidencePercent(null)).toBeNull();
  });
});

describe("decisionReasons", () => {
  it("reads code, message and weight from the agent reasons", () => {
    const reasons = [{ code: "SAFETY", message: "‘kıvılcım’ kelimesi", weight: 30, evidence: {} }];

    expect(decisionReasons(reasons)).toEqual([{ code: "SAFETY", message: "‘kıvılcım’ kelimesi", weight: 30 }]);
  });

  it("skips entries without a message instead of showing empty bullets", () => {
    expect(decisionReasons([{ code: "X" }, { message: "Geçerli" }])).toEqual([
      { code: "", message: "Geçerli", weight: null },
    ]);
  });
});

describe("decisionTitles", () => {
  it("prefers the Turkish labels sent by the API", () => {
    const decision = { agent_name: "supervisor", decision: "ESCALATE", agent_label: "Karar", decision_label: "Müdüre yükseltildi" };

    expect(decisionTitles(decision)).toEqual({ agent: "Karar", decision: "Müdüre yükseltildi" });
  });

  it("falls back to the local agent name and the decision code", () => {
    const decision = { agent_name: "classification", decision: "ELECTRICAL_FAULT", agent_label: null, decision_label: null };

    expect(decisionTitles(decision)).toEqual({ agent: "Sınıflandırma", decision: "ELECTRICAL_FAULT" });
  });
});

describe("override fields", () => {
  it("names the three fields the manager can correct", () => {
    expect(OVERRIDE_FIELD_LABELS).toEqual({ case_type: "Tür", priority: "Öncelik", department: "Birim" });
  });

  it.each([
    ["case_type", "SOAP_EMPTY"],
    ["priority", "LOW"],
    ["department", "SUPPORT_SERVICES"],
  ] as const)("starts the %s value from the AI suggestion", (field, value) => {
    expect(currentOverrideValue(base, field)).toBe(value);
  });

  it("starts empty when the AI made no suggestion", () => {
    expect(currentOverrideValue({ ...base, department: null }, "department")).toBe("");
  });
});
