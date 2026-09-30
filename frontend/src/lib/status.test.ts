import { describe, expect, it } from "vitest";

import { PROGRESS_STEPS, reporterView, stepState } from "./status";

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
});
