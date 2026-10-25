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
  const NONE = { status: "all", priorities: [], order: "newest" } as const;

  it("asks for every case of the person, newest first, when nothing is filtered", () => {
    expect(myCasesPath(NONE, 1)).toBe("/cases/mine?page=1&page_size=20&order=newest");
  });

  // /cases/mine artik /cases ile ayni suzgecleri alir (docs/API.md): her rol kendi bildirimlerini suzer
  it("asks for the open or solved ones by the same steps the reporter sees", () => {
    expect(myCasesPath({ ...NONE, status: "solved" }, 2)).toBe(
      "/cases/mine?page=2&page_size=20&status=RESOLVED&status=VERIFICATION&status=CLOSED&order=newest",
    );
    const open = new URLSearchParams(myCasesPath({ ...NONE, status: "open" }, 1).split("?")[1]).getAll("status");
    expect(open).toEqual(["NEW", "ANALYZING", "CLASSIFIED", "REOPENED", "ASSIGNED", "ACCEPTED", "ESCALATED", "IN_PROGRESS", "NEEDS_INFO"]);
  });

  it("adds the chosen priorities and the oldest-first order", () => {
    const params = new URLSearchParams(myCasesPath({ ...NONE, priorities: ["LOW", "MEDIUM"], order: "oldest" }, 1).split("?")[1]);

    expect(params.getAll("priority")).toEqual(["LOW", "MEDIUM"]);
    expect(params.get("order")).toBe("oldest");
  });

  it("offers three plain choices", () => {
    expect(MY_CASES_FILTERS.map((item) => item.label)).toEqual(["Tümü", "Açık", "Çözülen"]);
  });
});
