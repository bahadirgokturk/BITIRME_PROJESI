import { describe, expect, it } from "vitest";

import { formatDateTime, relativeTime } from "./dates";

const NOW = new Date("2026-09-27T12:00:00Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe("relativeTime", () => {
  it.each([
    [0, "Az önce"],
    [5, "5 dakika önce"],
    [3 * 60, "3 saat önce"],
    [2 * 24 * 60, "2 gün önce"],
  ])("shows %i minutes ago as %s", (minutes, text) => {
    expect(relativeTime(minutesAgo(minutes), NOW)).toBe(text);
  });
});

describe("formatDateTime", () => {
  it("shows the full date in Istanbul time", () => {
    expect(formatDateTime("2026-09-27T08:15:00Z")).toBe("27 Eyl 2026 11:15");
  });
});
