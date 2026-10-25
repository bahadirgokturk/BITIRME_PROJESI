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
  suggestionSummary,
  weightDetail,
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
    ["supervisor", "Karar"],
    ["intake", "Ön inceleme"],
    ["resolution", "İş kontrolü"],
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
    // Sifir guven ("benzer bildirim yok" gibi) okuyana bir sey soylemez
    expect(confidencePercent(0)).toBeNull();
  });
});

describe("decisionReasons", () => {
  it("drops a zero weight: it says nothing to the reader", () => {
    expect(decisionReasons([{ code: "NO_SIMILAR_CASE", message: "Benzer bildirim yok.", weight: 0 }])[0]?.weight).toBeNull();
  });

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

describe("weightDetail", () => {
  it.each([
    [8, "Konumun önemi · ağırlık +8"],
    [0.444, "Konumun önemi · ağırlık +0.444"],
    [-5, "Konumun önemi · ağırlık -5"],
  ])("writes weight %f next to its reason", (weight, text) => {
    expect(weightDetail({ code: "LOC", message: "Konumun önemi", weight })).toBe(text);
  });

  it("has nothing to add for a reason without weight", () => {
    expect(weightDetail({ code: "LOC", message: "Konumun önemi", weight: null })).toBeNull();
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

describe("suggestionSummary", () => {
  it("puts the AI's type, priority and unit on one line for the square card", () => {
    const routed = CASES.find((each) => each.case_type && each.department) ?? base;
    const suggested = item({ case: { ...routed, priority: "HIGH" } });

    expect(suggestionSummary(suggested)).toBe(
      `Öneri: ${routed.case_type?.name} · Yüksek · ${routed.department?.name}`,
    );
    expect(suggestionSummary(suggested)).not.toMatch(/undefined|belirlenmedi/);
  });

  it("names each missing part instead of leaving a gap", () => {
    const empty = item({ case: { ...base, case_type: null, priority: null, department: null } });

    expect(suggestionSummary(empty)).toBe("Öneri: Tür belirlenmedi · Öncelik belirlenmedi · Birim belirlenmedi");
  });
});
