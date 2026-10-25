import { describe, expect, it } from "vitest";

import {
  CASE_ORDERS,
  listParams,
  PRIORITY_FILTER_OPTIONS,
  priorityFilterSummary,
  TASK_ORDERS,
  taskListSummary,
} from "./listTools";

describe("priority filter", () => {
  it("offers the priorities most urgent first", () => {
    expect(PRIORITY_FILTER_OPTIONS.map((option) => option.label)).toEqual(["Kritik", "Yüksek", "Orta", "Düşük"]);
  });

  it.each([
    [[], "Öncelik: Tümü"],
    [["HIGH"], "Öncelik: Yüksek"],
    [["HIGH", "CRITICAL"], "Öncelik: 2 seçili"],
  ])("sums up %j as %j", (selected, text) => {
    expect(priorityFilterSummary(selected)).toBe(text);
  });
});

describe("sort choices", () => {
  it("lets cases go newest or oldest first", () => {
    expect(CASE_ORDERS.map((option) => option.label)).toEqual(["En yeni", "En eski"]);
  });

  // Gorevlerde varsayilan en acil (SLA hedefi en yakin) once; backend bunu order gonderilmeyince yapar
  it("keeps the most urgent task first by default", () => {
    expect(TASK_ORDERS.map((option) => option.label)).toEqual(["En acil", "En yeni", "En eski"]);
  });
});

describe("listParams", () => {
  it("repeats the priority and sends the order", () => {
    const params = listParams({ priorities: ["CRITICAL", "HIGH"], order: "oldest" });

    expect(params.getAll("priority")).toEqual(["CRITICAL", "HIGH"]);
    expect(params.get("order")).toBe("oldest");
  });

  it("leaves the order out for the most urgent tasks", () => {
    expect(listParams({ priorities: [], order: "urgent" }).toString()).toBe("");
  });
});

describe("taskListSummary", () => {
  it.each([
    ["urgent", "4 açık görev · en acil olan üstte"],
    ["newest", "4 açık görev · en yeni olan üstte"],
    ["oldest", "4 açık görev · en eski olan üstte"],
  ] as const)("says which task is on top for %s", (order, text) => {
    expect(taskListSummary(4, order)).toBe(text);
  });
});
