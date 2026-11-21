import { describe, expect, it } from "vitest";

import { IMPORT_MAX_BYTES, importProblems } from "./userImport";

const csv = (size: number) => new File(["x".repeat(size)], "liste.csv", { type: "text/csv" });

describe("importProblems", () => {
  it("asks for a file and a long enough password", () => {
    expect(importProblems({ file: null, password: "kisa" })).toEqual({
      file: "CSV dosyası seçin.",
      password: "Geçici parola en az 8 karakter olmalı.",
    });
  });

  // Backend 1 MB ustunu 413 ile reddeder; dosya hic gonderilmez
  it("refuses a file over 1 MB before sending", () => {
    expect(importProblems({ file: csv(IMPORT_MAX_BYTES + 1), password: "gecici-parola" }).file).toBe(
      "Dosya en fazla 1 MB olabilir.",
    );
    expect(importProblems({ file: csv(10), password: "gecici-parola" })).toEqual({});
  });
});
