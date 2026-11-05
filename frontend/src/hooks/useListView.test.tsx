import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { listViewKey } from "@/lib/listTools";

import { useListView } from "./useListView";

afterEach(() => window.localStorage.clear());

describe("useListView", () => {
  it("starts with the list when nothing was chosen before", () => {
    const { result } = renderHook(() => useListView("tasks"));

    expect(result.current[0]).toBe("list");
  });

  it("remembers the card view after the page is opened again", () => {
    const first = renderHook(() => useListView("tasks"));
    act(() => first.result.current[1]("grid"));
    first.unmount();

    const again = renderHook(() => useListView("tasks"));

    expect(again.result.current[0]).toBe("grid");
    expect(window.localStorage.getItem(listViewKey("tasks"))).toBe("grid");
  });

  it("does not carry one list's choice to another list", () => {
    const tasks = renderHook(() => useListView("tasks"));
    act(() => tasks.result.current[1]("grid"));

    const cases = renderHook(() => useListView("cases"));

    expect(cases.result.current[0]).toBe("list");
  });
});
