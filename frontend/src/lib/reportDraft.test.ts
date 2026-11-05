import { describe, expect, it } from "vitest";

import { isBlankDraft, parseReportDraft, REPORT_DRAFT_PREFIX, reportDraftKey } from "./reportDraft";

describe("reportDraftKey", () => {
  it("keeps one draft per signed-in user", () => {
    expect(reportDraftKey(7)).toBe(`${REPORT_DRAFT_PREFIX}7`);
    expect(reportDraftKey(7)).not.toBe(reportDraftKey(8));
  });
});

describe("parseReportDraft", () => {
  it("reads a saved draft", () => {
    const raw = JSON.stringify({ description: "Sabun bitmiş", locationId: "4", hadFiles: true });

    expect(parseReportDraft(raw)).toEqual({ description: "Sabun bitmiş", locationId: "4", hadFiles: true });
  });

  it("ignores a missing, broken or foreign value", () => {
    expect(parseReportDraft(null)).toBeNull();
    expect(parseReportDraft("{bozuk")).toBeNull();
    expect(parseReportDraft(JSON.stringify({ description: 5 }))).toBeNull();
    expect(parseReportDraft(JSON.stringify(["a"]))).toBeNull();
  });
});

describe("isBlankDraft", () => {
  it("treats a form with only spaces and no location as blank", () => {
    expect(isBlankDraft({ description: "   ", locationId: "", hadFiles: true })).toBe(true);
    expect(isBlankDraft({ description: "", locationId: "4", hadFiles: false })).toBe(false);
    expect(isBlankDraft({ description: "Sabun", locationId: "", hadFiles: false })).toBe(false);
  });
});
