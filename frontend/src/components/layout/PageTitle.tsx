import type { ReactNode } from "react";

import { cn } from "cn";

// Liste sayfalarinda 24 px, alt sayfalarda (bildirim detayi) 20 px (Figma: 03 Reporter)
const SIZE_CLASS = {
  lg: "text-2xl",
  md: "text-xl",
} as const;

interface PageTitleProps {
  children: ReactNode;
  size?: keyof typeof SIZE_CLASS;
}

// Sayfa basligi + altindaki kisa vurgu cizgisi (Figma: 03 Reporter, PageTitle)
export function PageTitle({ children, size = "lg" }: PageTitleProps) {
  return (
    <div className="space-y-1.5">
      <h1 className={cn("font-semibold", SIZE_CLASS[size])}>{children}</h1>
      <span aria-hidden className="block h-[3px] w-6 rounded-[2px] bg-brand-accent" />
    </div>
  );
}
