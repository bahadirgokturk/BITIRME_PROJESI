import { describe, expect, it } from "vitest";

import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY, nextTheme, resolveTheme, themeToggleTitle } from "./theme";

describe("resolveTheme", () => {
  // Kullanici bir kez sectiyse o gecerli; hic secmediyse cihazin kendi ayari
  it("keeps the theme the user chose", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("follows the device until the user chooses", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme("bozuk-deger", true)).toBe("dark");
  });
});

describe("theme toggle", () => {
  it("switches between light and dark", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("says what a click will do", () => {
    expect(themeToggleTitle("light")).toBe("Koyu moda geç");
    expect(themeToggleTitle("dark")).toBe("Açık moda geç");
  });
});

// Sayfa cizilmeden once calisan betik ayni anahtari okur (yoksa acilista beyaz parlama olur)
describe("THEME_INIT_SCRIPT", () => {
  it("reads the same stored choice and marks the page dark before it is drawn", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_INIT_SCRIPT).toContain('classList.add("dark")');
  });
});
