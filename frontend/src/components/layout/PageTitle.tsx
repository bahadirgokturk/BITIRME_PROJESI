import type { ReactNode } from "react";

// Sayfa basligi + altindaki kisa vurgu cizgisi (Figma: 03 Reporter, PageTitle)
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">{children}</h1>
      <span aria-hidden className="block h-[3px] w-6 rounded-[2px] bg-brand-accent" />
    </div>
  );
}
