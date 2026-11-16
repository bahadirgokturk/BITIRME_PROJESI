import { describe, expect, it } from "vitest";

import { recentWeeks, weeklyReportFileName, weeklyReportPath } from "./weeklyReport";

describe("recentWeeks", () => {
  // Hafta pazartesi-pazar (backend weekly_report_service week_of); icinde bulunulan hafta henuz bitmedi
  it("lists the last completed weeks, newest first", () => {
    const weeks = recentWeeks(new Date(2026, 10, 16, 10, 0), 3);

    expect(weeks.map((week) => week.monday)).toEqual(["2026-11-09", "2026-11-02", "2026-10-26"]);
    expect(weeks.map((week) => week.label)).toEqual(["9–15 Kas 2026", "2–8 Kas 2026", "26 Eki – 1 Kas 2026"]);
  });

  it("counts Sunday as the end of the current, unfinished week", () => {
    expect(recentWeeks(new Date(2026, 10, 15, 23, 0), 1)[0]?.monday).toBe("2026-11-02");
  });

  it("writes the year on both sides when the week crosses into a new year", () => {
    expect(recentWeeks(new Date(2027, 0, 5), 1)[0]?.label).toBe("28 Ara 2026 – 3 Oca 2027");
  });
});

describe("weekly report file", () => {
  it("asks for the week by its Monday and saves it under the backend's name", () => {
    expect(weeklyReportPath("2026-11-09")).toBe("/analytics/weekly-report?week=2026-11-09");
    expect(weeklyReportFileName("2026-11-09")).toBe("haftalik-rapor-2026-11-09.pdf");
  });
});
