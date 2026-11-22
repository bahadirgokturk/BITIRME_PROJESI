import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Indirme baglantisinin verdigi ornek dosya docs/templates'teki asil dosyayla ayni kalmali
describe("user import template", () => {
  it("matches docs/templates/kullanici-yukleme-ornek.csv", () => {
    const name = "kullanici-yukleme-ornek.csv";
    const served = readFileSync(join(process.cwd(), "public", "templates", name), "utf-8");
    const source = readFileSync(join(process.cwd(), "..", "docs", "templates", name), "utf-8");
    expect(served).toBe(source);
  });
});
