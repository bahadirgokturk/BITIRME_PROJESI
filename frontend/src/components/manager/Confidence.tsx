import { confidencePercent } from "@/lib/review";

const BADGE_CLASS =
  "inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-xs font-medium whitespace-nowrap";

// Guven: cerceveli rozette yuzde (Figma: 08 Yeni Stil (A)); deger yoksa ya da sifirsa gosterilmez
export function Confidence({ value }: { value: number | null }) {
  const label = confidencePercent(value);
  if (label === null) {
    return null;
  }
  return (
    <span className={BADGE_CLASS}>Güven {label}</span>
  );
}
