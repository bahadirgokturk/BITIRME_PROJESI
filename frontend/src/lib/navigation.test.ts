import { describe, expect, it } from "vitest";

import { navigationFor, ROLES } from "./navigation";

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

  it("keeps admin screens away from managers (gorev ayriligi)", () => {
    const managerHrefs = navigationFor("MANAGER").map((item) => item.href);

    expect(managerHrefs.some((href) => href.startsWith("/admin"))).toBe(false);
    expect(navigationFor("ADMIN").some((item) => item.href.startsWith("/admin"))).toBe(true);
  });
});
