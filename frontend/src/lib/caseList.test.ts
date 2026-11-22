import { describe, expect, it } from "vitest";

import { MANAGER_CASES } from "@/mocks/managerCaseFixtures";

import {
  CASE_STATUS_LABELS,
  CASE_STATUS_TONES,
  CASE_LIST_VIEWS,
  DEFAULT_FILTERS,
  STATUS_GROUPS,
  caseListQuery,
  categoryFilterSummary,
  groupFromParam,
  caseSla,
  caseSubtitle,
  isFiltered,
  shownSummary,
} from "./caseList";

const now = new Date("2026-10-05T09:00:00Z");
const base = MANAGER_CASES[0]!;

describe("status groups", () => {
  it("offers five plain choices instead of fourteen statuses", () => {
    expect(STATUS_GROUPS.map((group) => group.label)).toEqual([
      "Tümü",
      "Açık",
      "Kapanan",
      "Reddedilen ve birleştirilen",
      "Geciken",
    ]);
  });

  it("puts every status in exactly one of open, closed or dismissed", () => {
    const grouped = ["open", "closed", "dismissed"].flatMap(
      (value) => STATUS_GROUPS.find((group) => group.value === value)?.statuses ?? [],
    );

    expect([...grouped].sort()).toEqual(Object.keys(CASE_STATUS_LABELS).sort());
  });
});

describe("caseListQuery", () => {
  it("asks for the first page, newest first, without filters by default", () => {
    expect(caseListQuery(DEFAULT_FILTERS, 1)).toBe("page=1&page_size=20&order=newest");
  });

  it("sends the statuses of the chosen group, every chosen priority, the order and the trimmed search text", () => {
    const query = caseListQuery(
      { ...DEFAULT_FILTERS, group: "dismissed", priorities: ["CRITICAL", "HIGH"], order: "oldest", search: "  amfi projeksiyon " },
      2,
    );

    expect(query).toBe(
      "page=2&page_size=20&status=REJECTED&status=MERGED&priority=CRITICAL&priority=HIGH&order=oldest&q=amfi+projeksiyon",
    );
  });

  it("sends the department, every chosen category and the opening day range", () => {
    const filters = { departmentId: "7", categories: ["IT", "CLEANING"] as const, from: "2026-11-01", to: "2026-11-21" };
    const query = new URLSearchParams(caseListQuery({ ...DEFAULT_FILTERS, ...filters, categories: [...filters.categories] }, 1));

    expect(query.get("department_id")).toBe("7");
    expect(query.getAll("category")).toEqual(["IT", "CLEANING"]);
    expect(query.get("from")).toBe("2026-11-01");
    expect(query.get("to")).toBe("2026-11-21");
  });

  it("sends the chosen building as location_id (the backend includes its floors and rooms)", () => {
    const query = new URLSearchParams(caseListQuery({ ...DEFAULT_FILTERS, locationId: "2" }, 1));

    expect(query.get("location_id")).toBe("2");
  });

  it("leaves out empty extra filters", () => {
    const query = new URLSearchParams(caseListQuery(DEFAULT_FILTERS, 1));

    expect(["department_id", "location_id", "category", "from", "to"].filter((key) => query.has(key))).toEqual([]);
  });

  it("asks for open cases past their target time when late ones are wanted", () => {
    const query = new URLSearchParams(caseListQuery({ ...DEFAULT_FILTERS, group: "late" }, 1));

    expect(query.get("sla_status")).toBe("BREACHED");
    expect(query.getAll("status")).toContain("IN_PROGRESS");
    expect(query.getAll("status")).not.toContain("CLOSED");
  });
});

describe("isFiltered", () => {
  it("knows whether anything narrows the list", () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, search: "   " })).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, search: "wc" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, priorities: ["LOW"] })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, group: "open" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, departmentId: "3" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, locationId: "2" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, categories: ["IT"] })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, from: "2026-11-01" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, to: "2026-11-01" })).toBe(true);
    // Siralama listeyi daraltmaz: bos listede "filtreleri temizle" onerilmez
    expect(isFiltered({ ...DEFAULT_FILTERS, order: "oldest" })).toBe(false);
  });
});

describe("row texts", () => {
  it("writes the type and the readable location under the title", () => {
    expect(caseSubtitle(base)).toBe("Sabun bitti · B Blok Zemin Kat WC");
    expect(caseSubtitle({ ...base, case_type: null })).toBe("Tür belirlenmedi · B Blok Zemin Kat WC");
  });

  it("shows the time left or the delay for open cases with a target time", () => {
    const open = { ...base, status: "IN_PROGRESS" as const, sla_status: "AT_RISK" as const };

    expect(caseSla({ ...open, due_at: "2026-10-05T09:40:00Z" }, now)).toEqual({ status: "AT_RISK", label: "40 dk kaldı" });
    expect(caseSla({ ...open, sla_status: "BREACHED", due_at: "2026-10-05T08:35:00Z" }, now)).toEqual({
      status: "BREACHED",
      label: "25 dk gecikti",
    });
  });

  it("shows no time badge for finished cases or cases without a target time", () => {
    const due = { due_at: "2026-10-05T09:40:00Z", sla_status: "ON_TRACK" as const };

    expect(caseSla({ ...base, ...due, status: "CLOSED" }, now)).toBeNull();
    expect(caseSla({ ...base, ...due, status: "MERGED" }, now)).toBeNull();
    expect(caseSla({ ...base, status: "ASSIGNED", due_at: null, sla_status: null }, now)).toBeNull();
  });
});

describe("shownSummary", () => {
  it("says how many of the total are on screen", () => {
    expect(shownSummary(20, 64)).toBe("64 bildirimin ilk 20 tanesi gösteriliyor");
    expect(shownSummary(64, 64)).toBe("64 bildirim");
    expect(shownSummary(1, 1)).toBe("1 bildirim");
  });
});

describe("status tones", () => {
  it("colours statuses along the journey from orange (waiting) to teal (solved)", () => {
    expect(CASE_STATUS_TONES.ASSIGNED).toBe("waiting");
    expect(CASE_STATUS_TONES.ACCEPTED).toBe("accepted");
    expect(CASE_STATUS_TONES.IN_PROGRESS).toBe("working");
    expect(CASE_STATUS_TONES.RESOLVED).toBe("solved");
    expect(CASE_STATUS_TONES.CLOSED).toBe("closed");
  });

  it("marks what needs attention and greys out what is set aside", () => {
    expect(CASE_STATUS_TONES.ESCALATED).toBe("alert");
    expect(CASE_STATUS_TONES.NEEDS_INFO).toBe("warning");
    expect(CASE_STATUS_TONES.ANALYZING).toBe("info");
    expect(CASE_STATUS_TONES.MERGED).toBe("neutral");
    expect(CASE_STATUS_TONES.REJECTED).toBe("neutral");
  });
});

describe("case list views", () => {
  it("names the list by whose cases it shows and links rows under its own address", () => {
    expect(CASE_LIST_VIEWS.all).toMatchObject({ title: "Tüm Bildirimler", path: "/manager/cases" });
    expect(CASE_LIST_VIEWS.unit).toMatchObject({ title: "Birim Bildirimleri", path: "/staff/cases" });
    expect(CASE_LIST_VIEWS.unit.description).toMatch(/size atanan/);
    expect(CASE_LIST_VIEWS.unit.backText).toBe("Birim Bildirimleri'ne dön");
  });
});

describe("groupFromParam", () => {
  it("opens the list on a known status group from the address", () => {
    expect(groupFromParam("open")).toBe("open");
    expect(groupFromParam("late")).toBe("late");
  });

  it("falls back to all cases for a missing or unknown value", () => {
    expect(groupFromParam(undefined)).toBe("all");
    expect(groupFromParam("hepsi")).toBe("all");
    expect(groupFromParam(["open", "late"])).toBe("all");
  });
});

describe("categoryFilterSummary", () => {
  it("names one category and counts several", () => {
    expect(categoryFilterSummary([])).toBe("Kategori: Tümü");
    expect(categoryFilterSummary(["CLEANING"])).toBe("Kategori: Temizlik");
    expect(categoryFilterSummary(["CLEANING", "IT"])).toBe("Kategori: 2 seçili");
  });
});
