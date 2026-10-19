import { describe, expect, it } from "vitest";

import { MY_CASES_FILTERS, PROGRESS_STEPS, myCasesPath, reporterView, stepState } from "./status";

describe("stepState", () => {
  it.each([
    ["Alındı", "done"],
    ["Yönlendirildi", "done"],
    ["Çalışılıyor", "current"],
    ["Çözüldü", "todo"],
  ] as const)("marks %s as %s while the case is being worked on", (step, state) => {
    expect(stepState(step, "Çalışılıyor")).toBe(state);
  });
});

describe("reporterView", () => {
  it("lists the four reporter steps in order", () => {
    expect(PROGRESS_STEPS).toEqual(["Alındı", "Yönlendirildi", "Çalışılıyor", "Çözüldü"]);
  });

  it.each([
    ["NEW", "Alındı"],
    ["ANALYZING", "Alındı"],
    ["CLASSIFIED", "Alındı"],
    ["REOPENED", "Alındı"],
    ["ASSIGNED", "Yönlendirildi"],
    ["ACCEPTED", "Yönlendirildi"],
    ["ESCALATED", "Yönlendirildi"],
    ["IN_PROGRESS", "Çalışılıyor"],
    ["RESOLVED", "Çözüldü"],
    ["VERIFICATION", "Çözüldü"],
    ["CLOSED", "Çözüldü"],
  ] as const)("shows %s as the %s step", (status, step) => {
    expect(reporterView(status)).toEqual({ kind: "progress", step });
  });

  it.each([
    ["NEEDS_INFO", "Ek bilgi gerekiyor"],
    ["MERGED", "zaten bildirilmiş"],
    ["REJECTED", "reddedildi"],
  ] as const)("explains %s with a notice instead of progress", (status, text) => {
    const view = reporterView(status);

    expect(view.kind).toBe("notice");
    expect(view.kind === "notice" && view.message).toContain(text);
  });

  it("shows the question asked to the reporter when there is one", () => {
    const view = reporterView("NEEDS_INFO", "Hangi katta?");

    expect(view).toEqual({ kind: "notice", message: "Ek bilgi gerekiyor: Hangi katta?" });
  });
});

describe("myCasesPath", () => {
  it("asks for every case of the reporter when nothing is filtered", () => {
    expect(myCasesPath("all", 1)).toBe("/cases/mine?page=1&page_size=20");
  });

  // Bildirenin /cases kapsami yalniz kendi bildirimleridir (backend case_service.scope_for)
  it("asks for the open or solved ones by the same steps the reporter sees", () => {
    expect(myCasesPath("solved", 2)).toBe(
      "/cases?page=2&page_size=20&status=RESOLVED&status=VERIFICATION&status=CLOSED",
    );
    const open = new URLSearchParams(myCasesPath("open", 1).split("?")[1]).getAll("status");
    expect(open).toEqual(["NEW", "ANALYZING", "CLASSIFIED", "REOPENED", "ASSIGNED", "ACCEPTED", "ESCALATED", "IN_PROGRESS", "NEEDS_INFO"]);
  });

  it("offers three plain choices", () => {
    expect(MY_CASES_FILTERS.map((item) => item.label)).toEqual(["Tümü", "Açık", "Çözülen"]);
  });
});
