import { describe, expect, it } from "vitest";

import {
  DEFAULT_RULE_LABEL,
  EMPTY_SLA_RULE_FORM,
  filterSlaRules,
  formatDuration,
  formFromSlaRule,
  NO_SLA_RULE_FILTERS,
  slaRuleFormProblems,
  slaRuleRows,
  splitDuration,
  toMinutes,
  toSlaRuleCreate,
  toSlaRuleUpdate,
  type SlaRule,
  type SlaRuleForm,
} from "./adminSlaRules";

function rule(overrides: Partial<SlaRule>): SlaRule {
  return {
    id: 1,
    case_type_id: null,
    priority: "LOW",
    response_minutes: 240,
    resolution_minutes: 1440,
    warning_threshold_pct: 75,
    is_active: true,
    ...overrides,
  };
}

const TYPES = [
  { id: 1, name: "Sabun bitti", code: "SOAP_EMPTY" },
  { id: 3, name: "Elektrik arızası", code: "ELECTRICAL_FAILURE" },
];
const RULES = [
  rule({ id: 1, case_type_id: 1, priority: "LOW", response_minutes: 60, resolution_minutes: 240 }),
  rule({ id: 2, priority: "CRITICAL", response_minutes: 15, resolution_minutes: 60 }),
  rule({ id: 3, case_type_id: 3, priority: "HIGH", is_active: false }),
  rule({ id: 4, priority: "LOW" }),
];

const form = (overrides: Partial<SlaRuleForm>): SlaRuleForm => ({
  ...EMPTY_SLA_RULE_FORM,
  priority: "HIGH",
  response_amount: "30",
  resolution_amount: "4",
  ...overrides,
});

describe("formatDuration", () => {
  it.each([
    [15, "15 dk"],
    [60, "1 saat"],
    [90, "1 saat 30 dk"],
    [240, "4 saat"],
    [1440, "1 gün"],
    [1500, "1 gün 1 saat"],
    [10080, "7 gün"],
  ])("writes %i minutes as %s", (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text);
  });
});

describe("splitDuration and toMinutes", () => {
  it("picks the largest unit that divides evenly", () => {
    expect(splitDuration(2880)).toEqual({ amount: "2", unit: "day" });
    expect(splitDuration(240)).toEqual({ amount: "4", unit: "hour" });
    expect(splitDuration(90)).toEqual({ amount: "90", unit: "minute" });
  });

  it("turns an amount and a unit back into minutes", () => {
    expect(toMinutes("2", "day")).toBe(2880);
    expect(toMinutes(" 45 ", "minute")).toBe(45);
  });

  it.each(["", "0", "-3", "1.5", "abc"])("rejects %j", (amount) => {
    expect(toMinutes(amount, "hour")).toBeNull();
  });
});

describe("slaRuleRows", () => {
  it("puts default rules first by priority, then type rules by type name", () => {
    const rows = slaRuleRows(RULES, TYPES);

    expect(rows.map((row) => [row.typeName, row.rule.priority])).toEqual([
      [DEFAULT_RULE_LABEL, "LOW"],
      [DEFAULT_RULE_LABEL, "CRITICAL"],
      ["Elektrik arızası", "HIGH"],
      ["Sabun bitti", "LOW"],
    ]);
    expect(rows[2]?.typeCode).toBe("ELECTRICAL_FAILURE");
    expect(rows[0]?.typeCode).toBeNull();
  });

  it("still shows a rule whose type is not in the list yet", () => {
    expect(slaRuleRows([rule({ case_type_id: 99 })], undefined)[0]?.typeName).toBe("–");
  });
});

describe("filterSlaRules", () => {
  const rows = slaRuleRows(RULES, TYPES);
  const ids = (filters: Partial<typeof NO_SLA_RULE_FILTERS>) =>
    filterSlaRules(rows, { ...NO_SLA_RULE_FILTERS, ...filters }).map((row) => row.rule.id);

  it("searches the type name, including the default label", () => {
    expect(ids({ search: "ELEKTRİK" })).toEqual([3]);
    expect(ids({ search: "varsayılan" })).toEqual([4, 2]);
  });

  it("filters by priority and by status", () => {
    expect(ids({ priority: "LOW" })).toEqual([4, 1]);
    expect(ids({ status: "inactive" })).toEqual([3]);
  });
});

describe("slaRuleFormProblems", () => {
  it("accepts a complete form", () => {
    expect(slaRuleFormProblems(form({}), "create", RULES)).toEqual({});
  });

  it("asks for a priority and whole positive durations", () => {
    expect(slaRuleFormProblems(form({ priority: "", response_amount: "0", resolution_amount: "x" }), "create", RULES)).toEqual({
      priority: "Öncelik seçmelisiniz.",
      response_amount: "Süreyi 1 ya da daha büyük bir tam sayı olarak yazmalısınız.",
      resolution_amount: "Süreyi 1 ya da daha büyük bir tam sayı olarak yazmalısınız.",
    });
  });

  it("does not allow resolving faster than accepting", () => {
    const problems = slaRuleFormProblems(form({ response_amount: "5", response_unit: "hour" }), "create", RULES);
    expect(problems.resolution_amount).toBe("Çözüm hedefi kabul hedefinden kısa olamaz.");
  });

  it.each(["0", "100", "7.5", ""])("rejects warning threshold %j", (warning_pct) => {
    expect(slaRuleFormProblems(form({ warning_pct }), "create", RULES).warning_pct).toBe(
      "Uyarı eşiği 1 ile 99 arasında bir tam sayı olmalı.",
    );
  });

  it("refuses a second rule for the same type and priority, and says when the old one is inactive", () => {
    expect(slaRuleFormProblems(form({ priority: "CRITICAL" }), "create", RULES).priority).toBe(
      "Bu tür ve öncelik için zaten bir kural var.",
    );
    expect(slaRuleFormProblems(form({ case_type_id: "3" }), "create", RULES).priority).toBe(
      "Bu tür ve öncelik için pasif bir kural var; onu düzenleyip aktifleştirin.",
    );
    expect(slaRuleFormProblems(form({ priority: "CRITICAL" }), "edit", RULES)).toEqual({});
  });
});

describe("request bodies", () => {
  it("builds the create body in minutes", () => {
    expect(toSlaRuleCreate(form({ case_type_id: "3", warning_pct: "80" }))).toEqual({
      case_type_id: 3,
      priority: "HIGH",
      response_minutes: 30,
      resolution_minutes: 240,
      warning_threshold_pct: 80,
    });
    expect(toSlaRuleCreate(form({})).case_type_id).toBeNull();
  });

  it("sends only the changeable fields on update", () => {
    expect(toSlaRuleUpdate(form({ case_type_id: "3" }))).toEqual({
      response_minutes: 30,
      resolution_minutes: 240,
      warning_threshold_pct: 75,
    });
  });

  it("fills the form from a rule", () => {
    expect(formFromSlaRule(RULES[0] as SlaRule)).toEqual({
      case_type_id: "1",
      priority: "LOW",
      response_amount: "1",
      response_unit: "hour",
      resolution_amount: "4",
      resolution_unit: "hour",
      warning_pct: "75",
    });
  });
});
