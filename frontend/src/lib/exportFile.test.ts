import { describe, expect, it } from "vitest";

import { exportFileName } from "./exportFile";

describe("exportFileName", () => {
  // Ayni gun birden fazla aktarim dosya yoneticisinde tarihle ayrilir
  it("adds the local date and the xlsx extension", () => {
    expect(exportFileName("kullanicilar", new Date(2026, 10, 2, 23, 59))).toBe("kullanicilar-2026-11-02.xlsx");
  });
});
