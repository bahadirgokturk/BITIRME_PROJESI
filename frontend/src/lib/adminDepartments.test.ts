import { describe, expect, it } from "vitest";

import {
  departmentFormProblems,
  filterDepartments,
  memberCounts,
  memberLabel,
  normalizeCode,
  type Department,
} from "./adminDepartments";

const DEPARTMENTS: Department[] = [
  { id: 1, code: "SUPPORT_SERVICES", name: "Destek Hizmetleri Şube Müdürlüğü", is_active: true },
  { id: 2, code: "IT_SUPPORT", name: "Donanım ve Teknik Destek Şube Müdürlüğü", is_active: true },
  { id: 3, code: "NUTRITION", name: "Beslenme Hizmetleri", is_active: false },
];

const names = (list: Department[]) => list.map((item) => item.name);

describe("filterDepartments", () => {
  it("returns every department without filters", () => {
    expect(filterDepartments(DEPARTMENTS, { search: "", status: "all" })).toHaveLength(3);
  });

  it("searches the name with Turkish letters regardless of case", () => {
    expect(names(filterDepartments(DEPARTMENTS, { search: "ŞUBE", status: "all" }))).toEqual([
      "Destek Hizmetleri Şube Müdürlüğü",
      "Donanım ve Teknik Destek Şube Müdürlüğü",
    ]);
  });

  it("searches the code too", () => {
    expect(names(filterDepartments(DEPARTMENTS, { search: "it_sup", status: "all" }))).toEqual([
      "Donanım ve Teknik Destek Şube Müdürlüğü",
    ]);
  });

  it("filters by status", () => {
    expect(names(filterDepartments(DEPARTMENTS, { search: "", status: "inactive" }))).toEqual(["Beslenme Hizmetleri"]);
    expect(filterDepartments(DEPARTMENTS, { search: "", status: "active" })).toHaveLength(2);
  });
});

describe("memberCounts", () => {
  it("counts active users per department and skips users without one", () => {
    const counts = memberCounts([
      { department_id: 1, is_active: true },
      { department_id: 1, is_active: true },
      { department_id: 1, is_active: false },
      { department_id: 2, is_active: true },
      { department_id: null, is_active: true },
    ]);

    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(1);
    expect(counts.has(3)).toBe(false);
  });
});

describe("memberLabel", () => {
  it("says so in words when nobody is in the department", () => {
    expect(memberLabel(undefined)).toBe("Kullanıcı yok");
    expect(memberLabel(4)).toBe("4 kullanıcı");
  });
});

describe("normalizeCode", () => {
  it("turns typed text into the code format the backend accepts", () => {
    expect(normalizeCode("destek hizmetleri")).toBe("DESTEK_HIZMETLERI");
    expect(normalizeCode("Bilgi İşlem-2")).toBe("BILGI_ISLEM_2");
    expect(normalizeCode("çöğüş ı")).toBe("COGUS_I");
  });
});

describe("departmentFormProblems", () => {
  it("accepts a name and a valid code", () => {
    expect(departmentFormProblems({ name: "Kütüphane", code: "LIBRARY_1" }, "create")).toEqual({});
  });

  it("asks for a name and a code when adding", () => {
    expect(departmentFormProblems({ name: "  ", code: "" }, "create")).toEqual({
      name: "Birim adı yazmalısınız.",
      code: "Kod yazmalısınız.",
    });
  });

  it("explains which characters a code may contain", () => {
    expect(departmentFormProblems({ name: "Kütüphane", code: "KÜTÜP.1" }, "create").code).toBe(
      "Kod yalnız büyük harf (A-Z), rakam ve alt çizgi içerebilir.",
    );
  });

  it("does not check the code when editing (it cannot change)", () => {
    expect(departmentFormProblems({ name: "Kütüphane", code: "" }, "edit")).toEqual({});
  });
});
