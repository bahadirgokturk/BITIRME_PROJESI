import { describe, expect, it } from "vitest";

import { installPlatform, shouldShowInstallPrompt } from "./pwa";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("installPlatform", () => {
  it("uses the browser install prompt when the browser offered one (Android Chrome)", () => {
    expect(installPlatform(ANDROID_UA, true)).toBe("android");
  });

  it("falls back to instructions on iPhone, where Safari has no install prompt", () => {
    expect(installPlatform(IPHONE_UA, false)).toBe("ios");
  });

  it("offers nothing when the browser cannot install the app", () => {
    expect(installPlatform(ANDROID_UA, false)).toBeNull();
  });
});

describe("shouldShowInstallPrompt", () => {
  const ready = { platform: "android", standalone: false, dismissed: false, hasCases: true } as const;

  it("shows the prompt after the first case on an installable device", () => {
    expect(shouldShowInstallPrompt(ready)).toBe(true);
  });

  it("waits until the user has sent a case", () => {
    expect(shouldShowInstallPrompt({ ...ready, hasCases: false })).toBe(false);
  });

  it("never asks again once dismissed", () => {
    expect(shouldShowInstallPrompt({ ...ready, dismissed: true })).toBe(false);
  });

  it("stays hidden when the app is already installed", () => {
    expect(shouldShowInstallPrompt({ ...ready, standalone: true })).toBe(false);
  });

  it("stays hidden when the device cannot install", () => {
    expect(shouldShowInstallPrompt({ ...ready, platform: null })).toBe(false);
  });
});
