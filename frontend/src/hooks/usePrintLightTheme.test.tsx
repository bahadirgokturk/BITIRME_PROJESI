import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { usePrintLightTheme } from "./usePrintLightTheme";

const root = () => document.documentElement;

afterEach(() => {
  root().classList.remove("dark");
});

describe("usePrintLightTheme", () => {
  it("prints dark mode pages on a light theme and switches back afterwards", () => {
    root().classList.add("dark");
    renderHook(() => usePrintLightTheme());

    window.dispatchEvent(new Event("beforeprint"));
    expect(root()).not.toHaveClass("dark");

    window.dispatchEvent(new Event("afterprint"));
    expect(root()).toHaveClass("dark");
  });

  it("leaves a light page as it is", () => {
    renderHook(() => usePrintLightTheme());

    window.dispatchEvent(new Event("beforeprint"));
    window.dispatchEvent(new Event("afterprint"));

    expect(root()).not.toHaveClass("dark");
  });
});
