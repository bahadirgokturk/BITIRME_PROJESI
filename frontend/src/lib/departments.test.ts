import { describe, expect, it } from "vitest";

import { DEPARTMENTS_REPORT } from "@/mocks/reportFixtures";

import { departmentCards, departmentFilterSummary, departmentPath, periodFromParam, shownDepartments } from "./departments";

const items = DEPARTMENTS_REPORT.items;

describe("departmentCards", () => {
  it("puts the busiest unit first with its four numbers and staff line", () => {
    const cards = departmentCards([...items].reverse(), []);

    expect(cards.map((card) => card.name)).toEqual([
      "Destek Hizmetleri",
      "Bakım Onarım",
      "Bilgi İşlem Teknik Destek",
      "Beslenme Hizmetleri",
    ]);
    expect(cards[1]).toEqual({
      id: 2,
      name: "Bakım Onarım",
      stats: [
        { label: "Bildirim", value: "15" },
        { label: "Zamanında", value: "%78" },
        { label: "Tipik çözüm", value: "7 sa" },
        { label: "Açık görev", value: "18" },
      ],
      staff: "4 personel · kişi başı 4,5 açık görev",
    });
  });

  // Hic secim yoksa hepsi; secim varsa yalniz secilenler
  it("shows only the chosen units", () => {
    expect(departmentCards(items, [2, 4]).map((card) => card.id)).toEqual([2, 4]);
  });

  it("says plainly when a unit has no staff or no finished work", () => {
    const empty = { ...items[0]!, sla_compliance_pct: null, median_resolution_min: null, active_staff: 0, open_tasks_per_staff: null };

    const [card] = departmentCards([empty], []);

    expect(card!.stats[1]!.value).toBe("–");
    expect(card!.stats[2]!.value).toBe("–");
    expect(card!.staff).toBe("Personel yok");
  });
});

describe("filter texts", () => {
  const options = items.map((item) => ({ value: String(item.department.id), label: item.department.name }));

  it("names the choice on the filter button", () => {
    expect(departmentFilterSummary([], options)).toBe("Birimler: Tümü");
    expect(departmentFilterSummary(["2"], options)).toBe("Birimler: Bakım Onarım");
    expect(departmentFilterSummary(["1", "2"], options)).toBe("Birimler: 2 seçili");
  });

  it("counts what is shown", () => {
    expect(shownDepartments(4, 4)).toBe("4 birim");
    expect(shownDepartments(2, 4)).toBe("4 birimden 2'si gösteriliyor");
  });
});

describe("departmentPath", () => {
  // Secilen donem detayda da gecerli kalsin
  it("links to the unit detail and keeps a 30 day period", () => {
    expect(departmentPath(2, "7d")).toBe("/manager/departments/2");
    expect(departmentPath(2, "30d")).toBe("/manager/departments/2?period=30d");
  });
});

describe("periodFromParam", () => {
  // Adresten gelen deger elle degistirilebilir: yalniz bilinen donemler kabul edilir
  it("accepts only a known period from the address", () => {
    expect(periodFromParam("30d")).toBe("30d");
    expect(periodFromParam("7d")).toBe("7d");
    expect(periodFromParam(undefined)).toBe("7d");
    expect(periodFromParam("1y")).toBe("7d");
    expect(periodFromParam(["30d", "7d"])).toBe("7d");
  });
});
