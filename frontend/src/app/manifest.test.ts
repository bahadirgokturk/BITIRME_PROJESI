import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("web app manifest", () => {
  it("opens full screen in Turkish with the brand name (Figma: PWA ayarlari)", () => {
    const result = manifest();

    expect(result).toMatchObject({
      name: "BakırçayFlow",
      short_name: "BakırçayFlow",
      start_url: "/",
      display: "standalone",
      lang: "tr",
      theme_color: "#ffffff",
      background_color: "#ffffff",
    });
  });

  it("lists icons that exist, including a maskable one for Android", () => {
    const icons = manifest().icons ?? [];

    expect(icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      expect(existsSync(join(process.cwd(), "public", icon.src))).toBe(true);
    }
  });
});
