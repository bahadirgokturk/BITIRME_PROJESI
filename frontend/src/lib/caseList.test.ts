import { describe, expect, it } from "vitest";

import { MANAGER_CASES } from "@/mocks/managerCaseFixtures";

import {
  CASE_STATUS_LABELS,
  DEFAULT_FILTERS,
  STATUS_GROUPS,
  caseListQuery,
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
  it("asks for the first page without filters by default", () => {
    expect(caseListQuery(DEFAULT_FILTERS, 1)).toBe("page=1&page_size=20");
  });

  it("sends the statuses of the chosen group, the priority and the trimmed search text", () => {
    const query = caseListQuery({ group: "dismissed", priority: "HIGH", search: "  amfi projeksiyon " }, 2);

    expect(query).toBe("page=2&page_size=20&status=REJECTED&status=MERGED&priority=HIGH&q=amfi+projeksiyon");
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
    expect(isFiltered({ ...DEFAULT_FILTERS, priority: "LOW" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, group: "open" })).toBe(true);
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
