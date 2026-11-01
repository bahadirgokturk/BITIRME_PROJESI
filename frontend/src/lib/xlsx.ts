// Paket eklemeden gercek .xlsx: Office Open XML parcalari sikistirmasiz (stored) bir zip icine yazilir.
// Excel, LibreOffice ve Google E-Tablolar dosyayi dogrudan acar; Turkce harfler UTF-8 ile korunur.

export type Cell = string | number | null;

export interface Sheet {
  // Sayfa sekmesinin adi (Excel kurallarina gore temizlenir)
  name: string;
  columns: readonly string[];
  rows: readonly (readonly Cell[])[];
}

// ---- CRC-32 (zip ozelligi, polinom 0xEDB88320) ----

const CRC_POLYNOMIAL = 0xedb88320;
const BYTE_VALUES = 256;
const BITS_PER_BYTE = 8;

const CRC_TABLE = Array.from({ length: BYTE_VALUES }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
    value = value & 1 ? CRC_POLYNOMIAL ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> BITS_PER_BYTE);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---- Zip (sikistirmasiz) ----

// Zip ozelligindeki imzalar ve sabit alanlar (APPNOTE.TXT 4.3)
const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const ZIP_VERSION = 20;
// Bit 11: dosya adlari UTF-8
const UTF8_FLAG = 0x0800;
// 1 Ocak 1980, DOS tarih bicimi; dosyalara anlamli bir tarih gerekmiyor
const DOS_DATE = 0x0021;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_RECORD_SIZE = 22;

interface ZipEntry {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

class ByteWriter {
  private readonly view: DataView;
  readonly bytes: Uint8Array<ArrayBuffer>;
  private at = 0;

  constructor(size: number) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }

  u16(value: number) {
    this.view.setUint16(this.at, value, true);
    this.at += 2;
  }

  u32(value: number) {
    this.view.setUint32(this.at, value, true);
    this.at += 4;
  }

  raw(data: Uint8Array) {
    this.bytes.set(data, this.at);
    this.at += data.byteLength;
  }

  get position() {
    return this.at;
  }
}

// Yerel ve merkez basliklarin ortak kismi: surum, bayrak, yontem (0 = stored), tarih, crc, boyutlar, ad uzunlugu
function commonHeader(out: ByteWriter, entry: ZipEntry) {
  out.u16(ZIP_VERSION);
  out.u16(UTF8_FLAG);
  out.u16(0);
  out.u16(0);
  out.u16(DOS_DATE);
  out.u32(entry.crc);
  out.u32(entry.data.byteLength);
  out.u32(entry.data.byteLength);
  out.u16(entry.name.byteLength);
  out.u16(0);
}

function writeLocal(out: ByteWriter, entry: ZipEntry) {
  entry.offset = out.position;
  out.u32(LOCAL_SIGNATURE);
  commonHeader(out, entry);
  out.raw(entry.name);
  out.raw(entry.data);
}

function writeCentral(out: ByteWriter, entry: ZipEntry) {
  out.u32(CENTRAL_SIGNATURE);
  out.u16(ZIP_VERSION);
  commonHeader(out, entry);
  // yorum uzunlugu, disk no, ic ve dis nitelikler
  out.u16(0);
  out.u16(0);
  out.u16(0);
  out.u32(0);
  out.u32(entry.offset);
  out.raw(entry.name);
}

function writeEnd(out: ByteWriter, count: number, centralStart: number) {
  const centralSize = out.position - centralStart;
  out.u32(END_SIGNATURE);
  out.u16(0);
  out.u16(0);
  out.u16(count);
  out.u16(count);
  out.u32(centralSize);
  out.u32(centralStart);
  out.u16(0);
}

export function zipStored(files: readonly (readonly [string, string])[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = files.map(([name, text]) => {
    const data = encoder.encode(text);
    return { name: encoder.encode(name), data, crc: crc32(data), offset: 0 };
  });
  const size = entries.reduce(
    (sum, entry) => sum + LOCAL_HEADER_SIZE + CENTRAL_HEADER_SIZE + 2 * entry.name.byteLength + entry.data.byteLength,
    END_RECORD_SIZE,
  );
  const out = new ByteWriter(size);
  entries.forEach((entry) => writeLocal(out, entry));
  const centralStart = out.position;
  entries.forEach((entry) => writeCentral(out, entry));
  writeEnd(out, entries.length, centralStart);
  return out.bytes;
}

// ---- Calisma kitabi XML ----

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const LETTERS = 26;
const CHAR_A = 65;
// Excel sayfa adi kurallari: en fazla 31 harf, \ / ? * [ ] : yasak
const SHEET_NAME_MAX = 31;
// Sutun genisligi (karakter): en uzun degere gore, okunur sinirlar icinde
const MIN_WIDTH = 8;
const MAX_WIDTH = 60;
const WIDTH_PADDING = 2;

// XML'de gecersiz kontrol karakterleri atilir (sekme ve satir sonu kalir), ozel isaretler kacirilir
function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function columnName(index: number): string {
  const letter = String.fromCharCode(CHAR_A + (index % LETTERS));
  return index < LETTERS ? letter : columnName(Math.floor(index / LETTERS) - 1) + letter;
}

function sheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, SHEET_NAME_MAX).trim() || "Sayfa1";
}

// Baslik satirinda stil 1 (kalin); sayi <v>, metin satir ici dize; bos hucre yazilmaz
function cellXml(value: Cell, ref: string, header: boolean): string {
  if (value === null || value === "") {
    return "";
  }
  if (typeof value === "number") {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  const style = header ? ' s="1"' : "";
  const space = value.trim() === value ? "" : ' xml:space="preserve"';
  return `<c r="${ref}" t="inlineStr"${style}><is><t${space}>${escapeXml(value)}</t></is></c>`;
}

function rowXml(cells: readonly Cell[], rowIndex: number, header: boolean): string {
  const number = rowIndex + 1;
  const inner = cells.map((value, column) => cellXml(value, `${columnName(column)}${number}`, header)).join("");
  return `<row r="${number}">${inner}</row>`;
}

function columnWidths(sheet: Sheet): string {
  const widths = sheet.columns.map((title, column) => {
    const longest = sheet.rows.reduce((max, row) => Math.max(max, String(row[column] ?? "").length), title.length);
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + WIDTH_PADDING));
  });
  const cols = widths.map(
    (width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
  );
  return `<cols>${cols.join("")}</cols>`;
}

function worksheetXml(sheet: Sheet): string {
  const rows = [rowXml(sheet.columns, 0, true), ...sheet.rows.map((row, index) => rowXml(row, index + 1, false))];
  const pane = '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>';
  return (
    `${XML_HEAD}<worksheet xmlns="${MAIN_NS}"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView>` +
    `</sheetViews>${columnWidths(sheet)}<sheetData>${rows.join("")}</sheetData></worksheet>`
  );
}

const CONTENT_TYPES =
  `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ' +
  'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ' +
  'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ' +
  'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';

const ROOT_RELS =
  `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS =
  `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`;

// Iki yazi tipi (normal, kalin) ve iki hucre bicimi: 0 normal, 1 kalin baslik
const STYLES =
  `${XML_HEAD}<styleSheet xmlns="${MAIN_NS}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

function workbookXml(name: string): string {
  return (
    `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>` +
    `<sheet name="${escapeXml(sheetName(name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
}

// Tek sayfalik calisma kitabi; ilk satir kalin baslik ve kaydirmada sabit
export function buildXlsx(sheet: Sheet): Uint8Array<ArrayBuffer> {
  return zipStored([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", ROOT_RELS],
    ["xl/workbook.xml", workbookXml(sheet.name)],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS],
    ["xl/styles.xml", STYLES],
    ["xl/worksheets/sheet1.xml", worksheetXml(sheet)],
  ]);
}
