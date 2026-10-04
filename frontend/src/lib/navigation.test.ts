import { describe, expect, it } from "vitest";

import { activeNavHref, homePathFor, navigationFor, ROLES } from "./navigation";

describe("navigationFor", () => {
  it("gives every role a non-empty menu", () => {
    for (const role of ROLES) {
      expect(navigationFor(role).length).toBeGreaterThan(0);
    }
  });

  it("lets every role create a case (RBAC: case olusturma herkese acik)", () => {
    for (const role of ROLES) {
      expect(navigationFor(role).map((item) => item.href)).toContain("/report");
    }
  });

  it("shows task screens only to staff", () => {
    const rolesWithTasks = ROLES.filter((role) =>
      navigationFor(role).some((item) => item.href.startsWith("/staff")),
    );

    expect(rolesWithTasks).toEqual(["STAFF"]);
  });

  it("gives managers the review queue (docs/UI_GUIDE.md bolum 5.4)", () => {
    expect(navigationFor("MANAGER").map((item) => item.href)).toContain("/manager/review-queue");
    expect(navigationFor("REPORTER").map((item) => item.href)).not.toContain("/manager/review-queue");
  });

  it("keeps admin screens away from managers (gorev ayriligi)", () => {
    const managerHrefs = navigationFor("MANAGER").map((item) => item.href);

    expect(managerHrefs.some((href) => href.startsWith("/admin"))).toBe(false);
    expect(navigationFor("ADMIN").some((item) => item.href.startsWith("/admin"))).toBe(true);
  });
});

describe("activeNavHref", () => {
  it("marks the exact page", () => {
    expect(activeNavHref("REPORTER", "/my-cases")).toBe("/my-cases");
    expect(activeNavHref("REPORTER", "/report")).toBe("/report");
  });

  it("keeps the list item active on its sub pages (bildirim detayi)", () => {
    expect(activeNavHref("REPORTER", "/cases/101")).toBe("/my-cases");
  });

  it("does not match a page that only shares a prefix", () => {
    expect(activeNavHref("REPORTER", "/my-cases-old")).toBeNull();
    expect(activeNavHref("REPORTER", "/")).toBeNull();
  });
});

describe("menu labels", () => {
  it("uses sentence case for the report item (UI_GUIDE)", () => {
    expect(navigationFor("REPORTER")[0]?.label).toBe("Bildirim Yap");
  });

  it("names the manager screens in plain Turkish (UI_GUIDE bolum 6)", () => {
    const labels = Object.fromEntries(navigationFor("MANAGER").map((item) => [item.href, item.label]));

    expect(labels).toMatchObject({
      "/manager/dashboard": "Genel Bakış",
      "/manager/review-queue": "İnceleme Kuyruğu",
      "/manager/analytics": "Raporlar",
      "/manager/agents": "Yapay Zekâ Performansı",
      "/manager/cases": "Tüm Bildirimler",
    });
  });
});

describe("homePathFor", () => {
  it("opens the reporter's cases after login", () => {
    expect(homePathFor("REPORTER")).toBe("/my-cases");
  });

  it("has no landing page yet for roles whose screens are not built", () => {
    expect(homePathFor("STAFF")).toBeNull();
    expect(homePathFor("MANAGER")).toBeNull();
    expect(homePathFor("ADMIN")).toBeNull();
  });
});
