import { describe, expect, it } from "vitest";

import {
  activeNavHref,
  ADMIN_SECTIONS,
  homePathFor,
  navGroupsFor,
  navigationFor,
  ROLES,
  sectionTitle,
} from "./navigation";

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
      "/manager/departments": "Birim Performansı",
      "/manager/agents": "Yapay Zekâ Performansı",
      "/manager/cases": "Tüm Bildirimler",
    });
  });
});

describe("menus after the advisor meeting", () => {
  const labels = (role: (typeof ROLES)[number]) => navigationFor(role).map((item) => item.label);

  it("gives every role its own cases", () => {
    for (const role of ROLES) {
      expect(navigationFor(role).map((item) => item.href)).toContain("/my-cases");
      expect(activeNavHref(role, "/cases/101")).toBe("/my-cases");
    }
  });

  it("gives staff the cases of their unit", () => {
    expect(labels("STAFF")).toEqual(["Bildirim Yap", "Görevlerim", "Birim Bildirimleri", "Bildirimlerim"]);
    expect(activeNavHref("STAFF", "/staff/cases/301")).toBe("/staff/cases");
  });

  it("gives the admin the full case list too", () => {
    expect(labels("ADMIN")).toEqual([
      "Bildirim Yap",
      "Genel Bakış",
      "Raporlar",
      "Birim Performansı",
      "Yapay Zekâ Performansı",
      "Tüm Bildirimler",
      "Bildirimlerim",
      "Yönetim",
    ]);
    expect(labels("MANAGER").at(-1)).toBe("Bildirimlerim");
  });

  it("puts unit performance right below the reports for managers and admins", () => {
    for (const role of ["MANAGER", "ADMIN"] as const) {
      const list = labels(role);
      expect(list[list.indexOf("Raporlar") + 1]).toBe("Birim Performansı");
    }
    expect(activeNavHref("MANAGER", "/manager/departments/2")).toBe("/manager/departments");
  });
});

describe("ADMIN_SECTIONS", () => {
  it("lists the admin tabs in order, all under /admin", () => {
    expect(ADMIN_SECTIONS.map((section) => section.label)).toEqual(["Kullanıcılar", "Birimler", "Konumlar", "Bildirim Türleri", "Süre Hedefleri", "Yapay Zekâ Politikaları", "İşlem Kayıtları"]);
    expect(ADMIN_SECTIONS.every((section) => section.href.startsWith("/admin/"))).toBe(true);
  });
});

describe("homePathFor", () => {
  it("opens the reporter's cases after login", () => {
    expect(homePathFor("REPORTER")).toBe("/my-cases");
  });

  it("opens each role's own first screen", () => {
    expect(homePathFor("STAFF")).toBe("/staff/tasks");
    expect(homePathFor("MANAGER")).toBe("/manager/dashboard");
  });

  it("opens the admin screens for an admin", () => {
    expect(homePathFor("ADMIN")).toBe("/admin");
  });

  it("only sends a role to a page that is in its own menu", () => {
    for (const role of ROLES) {
      expect(navigationFor(role).map((item) => item.href)).toContain(homePathFor(role));
    }
  });
});

// Masaustu kenar cubugu menuyu basliklarla gruplar (Figma: 08 Yeni Stil (A))
describe("navGroupsFor", () => {
  it("puts every menu item in exactly one group, in the menu's items", () => {
    for (const role of ROLES) {
      const grouped = navGroupsFor(role).flatMap((group) => group.items.map((item) => item.href));
      expect(new Set(grouped).size).toBe(grouped.length);
      expect([...grouped].sort()).toEqual(navigationFor(role).map((item) => item.href).sort());
    }
  });

  it("splits the manager menu into management screens and personal ones", () => {
    const groups = navGroupsFor("MANAGER");

    expect(groups.map((group) => group.title)).toEqual(["Yönetim", "Kişisel"]);
    expect(groups[0]?.items.map((item) => item.label)).toEqual([
      "Genel Bakış",
      "İnceleme Kuyruğu",
      "Raporlar",
      "Birim Performansı",
      "Yapay Zekâ Performansı",
      "Tüm Bildirimler",
    ]);
    expect(groups[1]?.items.map((item) => item.label)).toEqual(["Bildirim Yap", "Bildirimlerim"]);
  });

  it("groups the staff work screens apart from personal ones", () => {
    expect(navGroupsFor("STAFF").map((group) => [group.title, group.items.map((item) => item.label)])).toEqual([
      ["İş", ["Görevlerim", "Birim Bildirimleri"]],
      ["Kişisel", ["Bildirim Yap", "Bildirimlerim"]],
    ]);
  });

  it("gives the reporter a single untitled group", () => {
    expect(navGroupsFor("REPORTER")).toEqual([{ title: null, items: navigationFor("REPORTER") }]);
  });
});

describe("sectionTitle", () => {
  it("names the menu item the page belongs to", () => {
    expect(sectionTitle("MANAGER", "/manager/dashboard")).toBe("Genel Bakış");
    expect(sectionTitle("REPORTER", "/cases/104")).toBe("Bildirimlerim");
    expect(sectionTitle("ADMIN", "/admin/users")).toBe("Yönetim");
  });

  it("is null outside the menu", () => {
    expect(sectionTitle("REPORTER", "/manager/dashboard")).toBeNull();
  });
});
