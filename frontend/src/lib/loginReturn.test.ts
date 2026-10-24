import { describe, expect, it } from "vitest";

import { loginHref, safeReturnPath } from "./loginReturn";

describe("returning after login", () => {
  // Yalniz QR'dan acilan bildirim formuna geri donulur; baska her adres ana sayfaya gider (acik yonlendirme yok)
  it.each([
    ["/report?location=12", "/report?location=12"],
    ["/report", "/"],
    ["/report?location=12&x=1", "/"],
    ["/report?location=abc", "/"],
    ["//evil.example.com/report?location=1", "/"],
    ["https://evil.example.com/report?location=1", "/"],
    ["/admin/users", "/"],
    [null, "/"],
  ])("goes from %j to %j", (next, path) => {
    expect(safeReturnPath(next)).toBe(path);
  });

  it("remembers a scanned report link on the way to the login page", () => {
    expect(loginHref("/report", "?location=12")).toBe("/login?next=%2Freport%3Flocation%3D12");
    expect(loginHref("/my-cases", "")).toBe("/login");
  });
});
