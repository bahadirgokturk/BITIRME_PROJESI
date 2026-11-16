import { buildXlsx, type Sheet } from "./xlsx";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DATE_PART = 2;

// "kullanicilar-2026-11-02.xlsx": yerel tarih, ayni gunun dosyalari tarayici tarafindan (1), (2) diye ayrilir
export function exportFileName(base: string, now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(DATE_PART, "0");
  return `${base}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`;
}

// Tarayicida indirme: dosya gecici bir adres ve indirme adli bir baglantiyla kaydedilir
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// Excel'e aktar: dosya bellekte uretilir
export function saveXlsx(sheet: Sheet, fileName: string): void {
  saveBlob(new Blob([buildXlsx(sheet)], { type: XLSX_TYPE }), fileName);
}
