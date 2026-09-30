import { describe, expect, it } from "vitest";

import { USERS } from "@/mocks/fixtures";

import { mobileBarFor, userDetail } from "./shell";

describe("mobileBarFor", () => {
  it("shows the menu bar on top level pages", () => {
    expect(mobileBarFor("/my-cases")).toEqual({ kind: "menu" });
    expect(mobileBarFor("/report")).toEqual({ kind: "menu" });
  });

  it("shows a back bar on a case detail page", () => {
    expect(mobileBarFor("/cases/101")).toEqual({ kind: "back", title: "Bildirim", backHref: "/my-cases" });
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
