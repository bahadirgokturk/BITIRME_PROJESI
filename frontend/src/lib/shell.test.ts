import { describe, expect, it } from "vitest";

import { USERS } from "@/mocks/fixtures";

import { initialsOf, mobileBarFor, parseSidebarOpen, userDetail } from "./shell";

describe("mobileBarFor", () => {
  it("shows the menu bar on top level pages", () => {
    expect(mobileBarFor("/my-cases")).toEqual({ kind: "menu" });
    expect(mobileBarFor("/report")).toEqual({ kind: "menu" });
  });

  it("shows a back bar on a case detail page", () => {
    expect(mobileBarFor("/cases/101")).toEqual({ kind: "back", title: "Bildirim", backHref: "/my-cases" });
  });

  it("sends a manager back to the full case list from a case detail page", () => {
    expect(mobileBarFor("/manager/cases/301")).toEqual({ kind: "back", title: "Bildirim", backHref: "/manager/cases" });
    expect(mobileBarFor("/manager/cases")).toEqual({ kind: "menu" });
  });

  it("sends a manager back to the unit list from a unit detail page", () => {
    expect(mobileBarFor("/manager/departments/2")).toEqual({ kind: "back", title: "Birim", backHref: "/manager/departments" });
  });

  it("sends staff back to the unit's cases from a case detail page", () => {
    expect(mobileBarFor("/staff/cases/301")).toEqual({ kind: "back", title: "Bildirim", backHref: "/staff/cases" });
    expect(mobileBarFor("/staff/cases")).toEqual({ kind: "menu" });
  });

  it("shows a back bar on a task detail page but not on the task list", () => {
    expect(mobileBarFor("/staff/tasks/201")).toEqual({ kind: "back", title: "Görev", backHref: "/staff/tasks" });
    expect(mobileBarFor("/staff/tasks")).toEqual({ kind: "menu" });
  });
});

describe("userDetail", () => {
  it("describes a reporter by reporter kind", () => {
    expect(userDetail(USERS.REPORTER)).toBe("Öğrenci");
    expect(userDetail({ ...USERS.REPORTER, reporter_kind: "ACADEMIC" })).toBe("Akademik personel");
  });

  it("describes other users by role", () => {
    expect(userDetail(USERS.STAFF)).toBe("Personel");
    expect(userDetail(USERS.MANAGER)).toBe("Birim müdürü");
    expect(userDetail(USERS.ADMIN)).toBe("Sistem yöneticisi");
  });
});

describe("initialsOf", () => {
  it("takes the first letter of the first and last name, in Turkish capitals", () => {
    expect(initialsOf("Mehmet Demir")).toBe("MD");
    expect(initialsOf("ilknur ışık")).toBe("İI");
    expect(initialsOf("Ayşe Nur Yılmaz")).toBe("AY");
  });

  it("uses one letter for a single word and nothing for an empty name", () => {
    expect(initialsOf("Admin")).toBe("A");
    expect(initialsOf("  ")).toBe("");
  });
});

describe("parseSidebarOpen", () => {
  it("keeps the desktop menu open unless it was closed on this device", () => {
    expect(parseSidebarOpen(null)).toBe(true);
    expect(parseSidebarOpen("open")).toBe(true);
    expect(parseSidebarOpen("closed")).toBe(false);
    expect(parseSidebarOpen("bozuk")).toBe(true);
  });
});
