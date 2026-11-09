import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIdleStart } from "./useIdleStart";

afterEach(() => vi.unstubAllGlobals());

describe("useIdleStart", () => {
  // Zil gibi ikincil sorgular sayfa acilisinda yer kaplamasin: tarayici bosa cikinca baslar
  it("turns true only once the browser is idle", () => {
    let runIdle: () => void = () => undefined;
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      runIdle = callback;
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    const { result } = renderHook(() => useIdleStart());
    expect(result.current).toBe(false);

    act(() => runIdle());
    expect(result.current).toBe(true);
  });

  it("falls back to a short timer where idle callbacks are missing", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);

    const { result } = renderHook(() => useIdleStart());
    expect(result.current).toBe(false);

    await act(() => vi.runAllTimersAsync());
    expect(result.current).toBe(true);
    vi.useRealTimers();
  });
});
