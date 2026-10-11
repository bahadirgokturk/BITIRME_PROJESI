import { describe, expect, it } from "vitest";

import {
  caseTypeFormProblems,
  EMPTY_CASE_TYPE_FORM,
  filterCaseTypes,
  formFromCaseType,
  NO_CASE_TYPE_FILTERS,
  parseKeywords,
  selectableDepartments,
  toCaseTypeBody,
  type CaseType,
  type CaseTypeForm,
} from "./adminCaseTypes";

function caseType(overrides: Partial<CaseType>): CaseType {
  return {
    id: 1,
    code: "SOAP_EMPTY",
    name: "Sabun bitti",
    category: "CONSUMABLE",
    default_department_id: 1,
    secondary_department_id: null,
    base_priority: "LOW",
    base_severity: 20,
    is_safety_related: false,
    keywords: ["sabun", "sabunluk"],
    is_active: true,
    ...overrides,
  };
}

const SOAP = caseType({});
const POWER = caseType({
  id: 2,
  code: "ELECTRICAL_FAILURE",
  name: "Elektrik arızası",
  category: "TECHNICAL",
  keywords: ["priz", "sigorta", "ışık"],
});
const LOST = caseType({ id: 3, code: "LOST_ITEM", name: "Kayıp eşya", category: "SECURITY", keywords: [], is_active: false });
const ALL = [SOAP, POWER, LOST];

const names = (items: CaseType[]) => items.map((item) => item.name);
const form = (overrides: Partial<CaseTypeForm>): CaseTypeForm => ({
  ...EMPTY_CASE_TYPE_FORM,
  name: "Asansör arızası",
  code: "ELEVATOR_FAILURE",
  category: "TECHNICAL",
  ...overrides,
});

describe("filterCaseTypes", () => {
  it("returns everything without filters", () => {
    expect(filterCaseTypes(ALL, NO_CASE_TYPE_FILTERS)).toHaveLength(3);
  });

  it("searches the name, the code and the keywords", () => {
    expect(names(filterCaseTypes(ALL, { ...NO_CASE_TYPE_FILTERS, search: "ELEKTRİK" }))).toEqual(["Elektrik arızası"]);
    expect(names(filterCaseTypes(ALL, { ...NO_CASE_TYPE_FILTERS, search: "lost item" }))).toEqual(["Kayıp eşya"]);
    expect(names(filterCaseTypes(ALL, { ...NO_CASE_TYPE_FILTERS, search: "Işık" }))).toEqual(["Elektrik arızası"]);
  });

  it("filters by category and by status", () => {
    expect(names(filterCaseTypes(ALL, { ...NO_CASE_TYPE_FILTERS, category: "CONSUMABLE" }))).toEqual(["Sabun bitti"]);
    expect(names(filterCaseTypes(ALL, { ...NO_CASE_TYPE_FILTERS, status: "inactive" }))).toEqual(["Kayıp eşya"]);
  });
});

describe("parseKeywords", () => {
  it("splits on commas and new lines, trims, lowercases and drops repeats", () => {
    expect(parseKeywords(" Asansör, kabin\nKAT ARASI , asansör ,, ")).toEqual(["asansör", "kabin", "kat arası"]);
  });
});

describe("caseTypeFormProblems", () => {
  it("accepts a complete form", () => {
    expect(caseTypeFormProblems(form({}), "create")).toEqual({});
  });

  it("asks for a name and a category", () => {
    expect(caseTypeFormProblems(form({ name: " ", category: "" }), "create")).toEqual({
      name: "Tür adı yazmalısınız.",
      category: "Kategori seçmelisiniz.",
    });
  });

  it("checks the code only while adding", () => {
    expect(caseTypeFormProblems(form({ code: "asansör" }), "create").code).toBe(
      "Kod yalnız büyük harf (A-Z), rakam ve alt çizgi içerebilir.",
    );
    expect(caseTypeFormProblems(form({ code: "" }), "create").code).toBe("Kod yazmalısınız.");
    expect(caseTypeFormProblems(form({ code: "" }), "edit")).toEqual({});
  });

  it.each(["", "abc", "-1", "101", "12.5"])("rejects severity %j", (base_severity) => {
    expect(caseTypeFormProblems(form({ base_severity }), "create").base_severity).toBe(
      "Ciddiyet 0 ile 100 arasında bir tam sayı olmalı.",
    );
  });

  it("limits each keyword to the backend's length", () => {
    const long = "a".repeat(51);
    expect(caseTypeFormProblems(form({ keywords: `kabin, ${long}` }), "create").keywords).toBe(
      "Her anahtar kelime en çok 50 karakter olabilir.",
    );
  });
});

describe("toCaseTypeBody", () => {
  it("sends departments as numbers or null and keywords as a list", () => {
    expect(toCaseTypeBody(form({ default_department_id: "2", base_severity: "70", is_safety_related: true, keywords: "Kabin, kat" }))).toEqual({
      name: "Asansör arızası",
      category: "TECHNICAL",
      default_department_id: 2,
      secondary_department_id: null,
      base_priority: "MEDIUM",
      base_severity: 70,
      is_safety_related: true,
      keywords: ["kabin", "kat"],
    });
  });
});

describe("formFromCaseType", () => {
  it("fills the form from a record", () => {
    expect(formFromCaseType(POWER)).toMatchObject({
      name: "Elektrik arızası",
      code: "ELECTRICAL_FAILURE",
      default_department_id: "1",
      secondary_department_id: "",
      base_severity: "20",
      keywords: "priz, sigorta, ışık",
    });
  });
});

describe("selectableDepartments", () => {
  const departments = [
    { id: 1, name: "Destek", is_active: true },
    { id: 2, name: "Eski birim", is_active: false },
  ];

  it("offers only active departments for a new type", () => {
    expect(selectableDepartments(departments, null).map((department) => department.id)).toEqual([1]);
  });

  it("keeps an inactive department the type is already linked to", () => {
    const linked = caseType({ secondary_department_id: 2 });
    expect(selectableDepartments(departments, linked).map((department) => department.id)).toEqual([1, 2]);
  });
});
