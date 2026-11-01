import { describe, expect, it } from "vitest";

import { buildXlsx, columnName, crc32 } from "./xlsx";

// Test icin kucuk zip okuyucu: merkez dizinden dosya adlarini ve (sikistirmasiz) iceriklerini cikarir
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.byteLength - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, string>();
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(dataStart, dataStart + size);
    expect(view.getUint32(at + 16, true)).toBe(crc32(data));
    files.set(name, decoder.decode(data));
    at += 46 + nameLength;
  }
  return files;
}

const SHEET = {
  name: "Kullanıcılar",
  columns: ["Ad soyad", "Önem"],
  rows: [
    ["Ayşe <Yılmaz> & Ortağı", 50],
    ["Boş değer", null],
  ],
};

describe("crc32", () => {
  // Zip ozelliginin bilinen deneme degeri
  it("matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("columnName", () => {
  it("writes Excel column letters", () => {
    expect([columnName(0), columnName(25), columnName(26), columnName(27)]).toEqual(["A", "Z", "AA", "AB"]);
  });
});

describe("buildXlsx", () => {
  it("packs the parts an Excel workbook needs", () => {
    const files = unzip(buildXlsx(SHEET));

    expect([...files.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    expect(files.get("xl/workbook.xml")).toContain('name="Kullanıcılar"');
  });

  it("writes a bold header, escaped text, numbers as numbers and empty cells as nothing", () => {
    const sheet = unzip(buildXlsx(SHEET)).get("xl/worksheets/sheet1.xml") ?? "";

    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t>Ad soyad</t></is></c>');
    expect(sheet).toContain("<t>Ayşe &lt;Yılmaz&gt; &amp; Ortağı</t>");
    expect(sheet).toContain('<c r="B2"><v>50</v></c>');
    expect(sheet).not.toContain('r="B3"');
    // Baslik satiri kaydirmada sabit kalir
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
  });

  it("keeps the sheet name within Excel's rules", () => {
    const files = unzip(buildXlsx({ ...SHEET, name: "Süre/Hedefleri: [çok] uzun bir sayfa adı burada" }));

    // Yasak isaretler bosluga doner, ad 31 harfte kesilir ve kenar bosluklari atilir
    expect(files.get("xl/workbook.xml")).toContain('name="Süre Hedefleri   çok  uzun bir"');
  });
});
