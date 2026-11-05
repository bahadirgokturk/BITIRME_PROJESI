// Renk token'larinin okunabilirlik bekcisi (WCAG 2.2 AA: normal yazi en az 4.5:1). Lighthouse olcumunde
// soluk gri, turkuaz, kirmizi ve turuncu yazilar kendi zeminlerinde 4.0-4.4 cikmisti (docs/UI_GUIDE.md bolum 8).
// Degerler globals.css'ten okunur; token degisirse bu test hesaplar.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const AA_NORMAL_TEXT = 4.5;
// Rozet zeminleri yazinin kendi renginin %10'u: bg-destructive/10, bg-warning/10, bg-primary/10
const TINT = 0.1;

type Rgb = [number, number, number];

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf("}", start));
}

function token(theme: ":root" | ".dark", name: string): Rgb {
  const match = new RegExp(String.raw`--${name}: oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)`).exec(block(theme));
  if (!match) {
    throw new Error(`${theme} icinde --${name} oklch degeri yok`);
  }
  return oklchToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

// OKLCH -> dogrusal sRGB (Bjorn Ottosson'un donusumu), 0-1 araligina kirpilir
function oklchToRgb(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1),
    clamp(-1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1),
    clamp(-0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1),
  ];
}

// Tarayici yari saydam rengi sRGB (gama) uzayinda karistirir
const toGamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const toLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

function tint(color: Rgb, base: Rgb): Rgb {
  return color.map((value, i) => toLinear(toGamma(value) * TINT + toGamma(base[i]!) * (1 - TINT))) as Rgb;
}

function contrast(fg: Rgb, bg: Rgb): number {
  const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const [light, dark] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

describe.each([":root", ".dark"] as const)("text colours on their backgrounds (%s)", (theme) => {
  const t = (name: string) => token(theme, name);

  it("keeps quiet grey text readable on grey panels and cards", () => {
    expect(contrast(t("muted-foreground"), t("muted"))).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(contrast(t("muted-foreground"), t("card"))).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("keeps turquoise text readable on grey panels and turquoise badges", () => {
    expect(contrast(t("primary-text"), t("muted"))).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(contrast(t("primary-text"), tint(t("primary"), t("card")))).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("keeps red and orange badge text readable on their own tint", () => {
    expect(contrast(t("destructive"), tint(t("destructive"), t("card")))).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(contrast(t("warning"), tint(t("warning"), t("card")))).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("keeps button text readable on turquoise", () => {
    expect(contrast(t("primary-foreground"), t("primary"))).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
