import { describe, expect, it } from "vitest";

import { CASES } from "@/mocks/caseFixtures";

import { closedCaseActions, isValidReopenReason, ratingLabel, REOPEN_REASON_MAX_LENGTH } from "./caseActions";

const NOW = new Date("2026-09-28T10:00:00Z");
const closed = { ...CASES[0]!, status: "CLOSED" as const, closed_at: "2026-09-27T10:00:00Z" };

describe("closedCaseActions", () => {
  it("lets the reporter rate and reopen within 72 hours of closing", () => {
    expect(closedCaseActions(closed, NOW)).toEqual({ canRate: true, canReopen: true, rating: null });
  });

  it("closes both actions after 72 hours", () => {
    const late = new Date("2026-09-30T10:00:01Z");

    expect(closedCaseActions(closed, late)).toEqual({ canRate: false, canReopen: false, rating: null });
  });

  it("allows only one rating but still allows reopening", () => {
    expect(closedCaseActions({ ...closed, satisfaction_rating: 4 }, NOW)).toEqual({
      canRate: false,
      canReopen: true,
      rating: 4,
    });
  });

  it("offers nothing while the case is still open", () => {
    expect(closedCaseActions({ ...closed, status: "IN_PROGRESS", closed_at: null }, NOW)).toEqual({
      canRate: false,
      canReopen: false,
      rating: null,
    });
  });
});

describe("ratingLabel", () => {
  it("describes the chosen rating in words", () => {
    expect(ratingLabel(1)).toBe("1 / 5 · Çok kötü");
    expect(ratingLabel(4)).toBe("4 / 5 · İyi");
    expect(ratingLabel(5)).toBe("5 / 5 · Çok iyi");
  });
});

describe("isValidReopenReason", () => {
  it("requires a reason", () => {
    expect(isValidReopenReason("   ")).toBe(false);
    expect(isValidReopenReason("Çöp kutusu yine taşmış.")).toBe(true);
  });

  it("rejects a reason longer than the backend limit", () => {
    expect(isValidReopenReason("a".repeat(REOPEN_REASON_MAX_LENGTH))).toBe(true);
    expect(isValidReopenReason("a".repeat(REOPEN_REASON_MAX_LENGTH + 1))).toBe(false);
  });
});
