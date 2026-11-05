import type { ReactNode } from "react";

import { cn } from "cn";

// Liste sayfalarinda 24 px (masaustunde 28 px, yeni stil), alt sayfalarda (bildirim detayi) 20 px (Figma: 03 Reporter)
const SIZE_CLASS = {
  lg: "text-2xl tracking-tight md:text-[28px]",
  md: "text-xl",
} as const;

interface PageTitleProps {
  children: ReactNode;
  size?: keyof typeof SIZE_CLASS;
}

// Sayfa basligi; alttaki turuncu vurgu cizgisi kaldirildi, baslik tek basina durur (Figma: 03 Reporter, PageTitle)
export function PageTitle({ children, size = "lg" }: PageTitleProps) {
  return <h1 className={cn("font-semibold", SIZE_CLASS[size])}>{children}</h1>;
}
