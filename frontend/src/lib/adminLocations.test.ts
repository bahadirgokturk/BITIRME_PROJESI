import { describe, expect, it } from "vitest";

import {
  filterLocations,
  locationFormProblems,
  locationRows,
  locationTrail,
  parentOptions,
  parseAliases,
  rootIds,
  toCreateBody,
  toUpdateBody,
  type AdminLocation,
  type LocationForm,
} from "./adminLocations";

function location(fields: Partial<AdminLocation> & Pick<AdminLocation, "id" | "path">): AdminLocation {
  return {
    parent_id: null,
    kind: "ROOM",
    code: fields.path.split("/").at(-1) ?? "",
    name: `Konum ${fields.id}`,
    importance_weight: 50,
    aliases: [],
    is_active: true,
    ...fields,
  };
}

// Liste backend'den agac sirasinda (path'e gore) gelir
const LOCATIONS: AdminLocation[] = [
  location({ id: 1, path: "KMP", kind: "CAMPUS", name: "Merkez Kampüs" }),
  location({ id: 6, path: "KMP/A", parent_id: 1, kind: "BUILDING", name: "A Blok", is_active: false }),
  location({ id: 2, path: "KMP/B", parent_id: 1, kind: "BUILDING", name: "B Blok" }),
  location({ id: 3, path: "KMP/B/B-2", parent_id: 2, kind: "FLOOR", name: "B Blok 2. Kat", aliases: ["b2"] }),
  location({ id: 4, path: "KMP/B/B-2/B-2-WCM", parent_id: 3, kind: "WC", name: "Erkek WC", aliases: ["erkek tuvalet"] }),
  location({ id: 5, path: "KMP/B/B-2/B-201", parent_id: 3, name: "B201 Amfi", importance_weight: 90 }),
];

const at = (index: number) => LOCATIONS[index] as AdminLocation;
const ids = (rows: { location: AdminLocation }[]) => rows.map((row) => row.location.id);

describe("locationRows", () => {
  it("shows only the top level when nothing is open", () => {
    const rows = locationRows(LOCATIONS, new Set());

    expect(ids(rows)).toEqual([1]);
    expect(rows[0]).toMatchObject({ depth: 0, hasChildren: true, expanded: false });
  });

  it("shows the children of open rows, one level at a time", () => {
    const rows = locationRows(LOCATIONS, new Set([1, 2]));

    expect(ids(rows)).toEqual([1, 6, 2, 3]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 1, 2]);
    expect(rows[1]).toMatchObject({ hasChildren: false });
    expect(rows[3]).toMatchObject({ hasChildren: true, expanded: false });
  });

  it("keeps a branch hidden while one of its parents is closed", () => {
    expect(ids(locationRows(LOCATIONS, new Set([1, 3])))).toEqual([1, 6, 2]);
  });
});

describe("rootIds", () => {
  it("opens the top level by default", () => {
    expect([...rootIds(LOCATIONS)]).toEqual([1]);
  });
});

describe("locationTrail", () => {
  it("lists the parents from the top", () => {
    expect(locationTrail(at(4), LOCATIONS)).toBe("Merkez Kampüs › B Blok › B Blok 2. Kat");
    expect(locationTrail(at(0), LOCATIONS)).toBe("");
  });
});

describe("filterLocations", () => {
  const names = (search: string, status: "all" | "active" | "inactive" = "all") =>
    filterLocations(LOCATIONS, { search, status }).map((item) => item.name);

  it("searches name, code and other names with Turkish letters", () => {
    expect(names("KAMPÜS")).toEqual(["Merkez Kampüs"]);
    expect(names("b-201")).toEqual(["B201 Amfi"]);
    expect(names("tuvalet")).toEqual(["Erkek WC"]);
  });

  it("filters by status", () => {
    expect(names("", "inactive")).toEqual(["A Blok"]);
    expect(names("blok", "active")).toEqual(["B Blok", "B Blok 2. Kat"]);
  });
});

describe("parentOptions", () => {
  it("offers every location, indented by depth, when adding", () => {
    const options = parentOptions(LOCATIONS, null);

    expect(options).toHaveLength(6);
    expect(options[0]).toEqual({ id: 1, label: "Merkez Kampüs" });
    expect(options[3]?.label.trimStart()).toBe("B Blok 2. Kat");
    expect(options[3]?.label.length).toBeGreaterThan("B Blok 2. Kat".length);
  });

  it("leaves out the location itself and everything under it when moving", () => {
    expect(parentOptions(LOCATIONS, at(2)).map((option) => option.id)).toEqual([1, 6]);
  });
});

describe("parseAliases", () => {
  it("splits on commas and drops empty parts", () => {
    expect(parseAliases(" b2 wc, erkek tuvalet ,, ")).toEqual(["b2 wc", "erkek tuvalet"]);
    expect(parseAliases("")).toEqual([]);
  });
});

const FORM: LocationForm = { name: "B202 Derslik", kind: "ROOM", code: "B-202", parent_id: "3", importance: "70", aliases: "b202" };

describe("locationFormProblems", () => {
  it("accepts a complete form", () => {
    expect(locationFormProblems(FORM, "create")).toEqual({});
  });

  it("asks for a name and a code when adding", () => {
    expect(locationFormProblems({ ...FORM, name: " ", code: "" }, "create")).toEqual({
      name: "Konum adı yazmalısınız.",
      code: "Kod yazmalısınız.",
    });
  });

  it("does not allow a slash in the code", () => {
    expect(locationFormProblems({ ...FORM, code: "B/202" }, "create").code).toBe("Kodda eğik çizgi (/) kullanılamaz.");
  });

  it("keeps the importance between 0 and 100", () => {
    const message = "Önem 0 ile 100 arasında bir tam sayı olmalı.";
    expect(locationFormProblems({ ...FORM, importance: "101" }, "create").importance).toBe(message);
    expect(locationFormProblems({ ...FORM, importance: "" }, "edit").importance).toBe(message);
    expect(locationFormProblems({ ...FORM, importance: "7.5" }, "edit").importance).toBe(message);
  });

  it("does not check the code when editing (it cannot change)", () => {
    expect(locationFormProblems({ ...FORM, code: "" }, "edit")).toEqual({});
  });
});

describe("toCreateBody", () => {
  it("builds the request with numbers and a list of other names", () => {
    expect(toCreateBody({ ...FORM, name: " B202 Derslik " })).toEqual({
      name: "B202 Derslik",
      kind: "ROOM",
      code: "B-202",
      parent_id: 3,
      importance_weight: 70,
      aliases: ["b202"],
    });
  });

  it("sends no parent for a top-level location", () => {
    expect(toCreateBody({ ...FORM, parent_id: "" }).parent_id).toBeNull();
  });
});

describe("toUpdateBody", () => {
  const original = at(5);
  const same: LocationForm = { name: "B201 Amfi", kind: "ROOM", code: "B-201", parent_id: "3", importance: "90", aliases: "" };

  it("sends the parent only when the location is moved (null would move it to the top)", () => {
    expect(toUpdateBody(same, original)).toEqual({ name: "B201 Amfi", importance_weight: 90, aliases: [] });
    expect(toUpdateBody({ ...same, parent_id: "2" }, original).parent_id).toBe(2);
    expect(toUpdateBody({ ...same, parent_id: "" }, original).parent_id).toBeNull();
  });
});
